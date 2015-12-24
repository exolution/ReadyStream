var Transform = require('stream').Transform;
var Readable = require('stream').Readable;
var Writable = require('stream').Writable;
var Util = require('util');
var Fs = require('fs');
var rawPipe = Readable.prototype.pipe;
var rawEnd = Writable.prototype.end;
/**
 * ReadyStream
 * @author exolution
 * @version 0.10
 * @since 2015
 */
function ReadyStream(config, transform) {

    if(typeof config === 'function') {
        this._transform = config;
    }
    else {
        this.config = config || {};
        if(typeof transform === 'function') {
            this._transform = transform;
        }
    }
    //it's a transform stream
    // 继承于transform类
    Transform.call(this, config);
    this.writeRequestManager = new WriteRequestManager(this);
    //实际上它本身是一系列transform流的链 它内部永远保存最新流经的transform流的引用
    //in fact,it's a chain of transform stream.it hold the latest transform stream which data flowed in
    this.currentStream = this;
    this.on('pipe', function(source) {
        this.writeRequestManager.addStream(source);
    });
}
Util.inherits(ReadyStream, Transform);
//implement _transform
ReadyStream.prototype._transform = function(chunk, encoding, next) {
    next(null, chunk);
};
/**
 * extended pipe
 * you can pipe the stream to a function which as processor of this stream data
 * in fact,this function will be encapsulated to a transform stream.
 *
 * 扩展的pipe
 * 引流
 * 把当前的数据流引入到一个管子里 这个管子由dest参数指定，管子可以是一个函数 这个函数作为流的加工函数（实际上这个函数会被封装成transform stream）
 * buffered参数为true时 会buffer所有的流数据 等流数据写入完成后一次性调用这个加工函数
 * 否则 可能会调用多次（流本身就不是一次性写完的）
 * bypass代表是否分流 默认为false 意思是正常情况下 每次调用pipe 就会给流接一个管子 这些管子是依次串联的
 * 如果bypass =true 这些管子则会并联的接起来。另外如果pipe到一个只可写不可读的单向流 默认分流
 */
ReadyStream.prototype.pipe = function(dest, buffered, bypass) {
    if(typeof dest === 'function') {
        var transform = new Transform(this.config);
        if(this.config.objectMode) buffered = false;
        transform._transform = dest;
        if(buffered) {
            var bufferList = [], encoding;
            transform._transform = function(chunk, enc, next) {
                bufferList.push(chunk);
                encoding = enc;
                next();
            };
            transform._flush = function(done) {
                dest.call(transform, Buffer.concat(bufferList), encoding, done);
                bufferList = null;
            }
        }
        else {
            transform._transform = dest;
        }
        rawPipe.call(this.currentStream, transform);
        if(!bypass)this.currentStream = transform;
    }
    else {
        rawPipe.call(this.currentStream, dest);
        if(dest.readable && !bypass) {
            this.currentStream = dest;
        }
    }
    return this;
};
/**
 * 分流stream
 * */
ReadyStream.prototype.bypass = function(dest, buffered) {
    return this.pipe(dest, buffered, true);
};
/*
 * 写入文件数据 这是一个异步的写操作
 * 如果多次调用此方法 后续的写操作只有在上一个文件全部写入后才会执行
 * */
ReadyStream.prototype.writeFile = function(path, config, manualEnd) {
    this.inflow(Fs.createReadStream(path, config), manualEnd);
};
/**
 * 写入一个流 其实相当于.pipe(readySteam);
 * */
ReadyStream.prototype.inflow = function(readableStream, manualEnd) {
    readableStream.pipe(this, manualEnd ? {end : false} : undefined);
};
/*
 * 异步写数据操作
 * 异步写操作会等待之前所有的异步写操作完成之后才会写入
 * 如果之前没有异步写操作 则会立即（同步）写入数据
 * */
ReadyStream.prototype.put = function(data) {
    if(data === null || data === undefined) {
        return null;
    }
    if(typeof data.doWrite === 'function') {
        var writeRequest = data;
        writeRequest._async=true;
    }
    else if(data.readable) {
        writeRequest = new StreamWriteRequest(data);
    }
    else {
        writeRequest = new DataWriteRequest(data);
    }
    this.writeRequestManager.addOrRun(writeRequest)
};
ReadyStream.prototype.end = function(chunk, encoding, cb) {
    this.writeRequestManager.end(chunk, encoding, cb);
};
ReadyStream.prototype.drain = function() {
    this.writeRequestManager.drain();
};
/**
 * 写入请求管理器
 * */
function WriteRequestManager(readyStream) {
    this.readyStream = readyStream;
    this.stack = [
        {
            end:null,
            writeRequest:[]
        }
    ];
}
WriteRequestManager.prototype.push = function(writeRequest) {
    this.stack[this.stack.length - 1].writeRequest.push(writeRequest);
};
WriteRequestManager.prototype.newContext = function() {
    this.stack.push({
        end:null,
        writeRequest:[]
    });
};
WriteRequestManager.prototype.addOrRun = function(writeRequest) {
    if(this.isWriting()) {
        this.push(writeRequest);
    }
    else {
        this.run(writeRequest, true);
    }
};
WriteRequestManager.prototype.drain = function() {
    var context = this.stack[this.stack.length - 1];
    context.writeRequest.shift();
    if(context.writeRequest.length > 0) {
        this.run(context.writeRequest[0]);
        if(context.writeRequest[0].sync) {
            this.drain();
        }
    }

    else if(context.end) {
        if(this.stack.length > 1){
            this.stack.pop();
            this.drain();
        }
        else{
            this.end(context.end.chunk, context.end.encoding, context.end.cb);
        }
    }
};
WriteRequestManager.prototype.run = function(writeRequest, immediately) {
    var self = this;
    if(writeRequest._async) {
        if(immediately)this.push(writeRequest);
        process.nextTick(function() {
            self.newContext();
            writeRequest.doWrite(self.readyStream);
        });
    }
    else {
        writeRequest.doWrite(this.readyStream);
    }
};
WriteRequestManager.prototype.end=function(chunk, encoding, cb){
    if(this.stack.length==1&&!this.isWriting()){
        rawEnd.call(this.readyStream,chunk, encoding, cb);
    }
    else{
        if(this.currentSourceStream){
            if(this.currentSourceStream._readableState.ended){
                this.currentSourceStream=null;
                this.drain();
            }
            else{
                this.stack[this.stack.length-1].end = {
                    chunk    : chunk,
                    encoding : encoding,
                    cb       : cb
                };
            }
        }
        else{
            this.stack[this.stack.length-1].end = {
                chunk    : chunk,
                encoding : encoding,
                cb       : cb
            };
            if(!this.isWriting()){
                this.drain();
            }
        }
    }
};
WriteRequestManager.prototype.addStream = function(stream) {
    if(this.isWriting()) {
        process.nextTick(function() {
            stream.pause();
        })
    }
    else {
        this.currentSourceStream = stream;
    }
    this.push(new StreamWriteRequest(stream));

};
WriteRequestManager.prototype.isWriting = function() {
    return this.stack[this.stack.length - 1].writeRequest.length > 0;
};
function _serializeData(data) {
    if(typeof data == 'object') {
        if(!Buffer.isBuffer(data)) {
            return JSON.stringify(data);
        }
        else {
            return data;
        }
    }
    else if(data !== undefined && data !== null) {
        return data.toString();
    }
    else {
        return "";
    }
}
function DataWriteRequest(data) {
    this.sync = true;
    if(data === undefined || data === null) {
        return null;
    }
    this.data = _serializeData(data);
}
DataWriteRequest.prototype.doWrite = function(readyStream) {
    readyStream.write(this.data);
};
function StreamWriteRequest(stream) {
    this.stream = stream;
}
StreamWriteRequest.prototype.doWrite = function(readyStream) {
    readyStream.writeRequestManager.currentSourceStream = this.stream;
    var self = this;
    process.nextTick(function() {
        self.stream.resume();
    });

};
module.exports = function(config, transform) {
    return new ReadyStream(config, transform);
};
module.exports.WriteRequest={
    implement:function(definition){
        var WriteRequest=definition.hasOwnProperty("constructor")?definition.constructor:function WriteRequest(){};
        WriteRequest.prototype=definition;
        return WriteRequest;
    }
};
