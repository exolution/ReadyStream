
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
function ReadyStream(config,transform) {

    if(typeof config==='function'){
        this._transform=config;
    }
    else{
        this.config=config||{};
        if(typeof transform==='function'){
            this._transform=transform;
        }
    }
    //it's a transform stream
    // 继承于transform类
    Transform.call(this,config);
    //write Request queue for ensure the sequence of async write operation
    //写请求队列  用来确保一系列异步写操作的顺序性
    this._writeRequest = [];
    //whether a async write operation in progress
    //是否正在执行写操作
    this._writing = false;
    //delayed end
    //延迟的end信息 当前stream有异步的写入操作（如writeFile）此时不能立即执行end需要等所有的异步写入操作都完成后再执行end
    this._end = null;
    //实际上它本身是一系列transform流的链 它内部永远保存最新流经的transform流的引用
    //in fact,it's a chain of transform stream.it hold the latest transform stream which data flowed in
    this._currentStream = this;
    this._sources=[];
    this.on('pipe',function(source){
        if(this._writing||this._sources.length>0){
            this._writeRequest.push(new StreamWriteRequest(source));
            process.nextTick(function(){
                source.pause();
            })
        }
        else{
            this._writing=true;
            this._writingSource=source;
        }
    });
}
Util.inherits(ReadyStream, Transform);

//implement _transform
ReadyStream.prototype._transform=function(chunk, encoding, next) {
    next(null,chunk);
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
ReadyStream.prototype.pipe = function(dest, buffered,bypass) {
    if(typeof dest === 'function') {
        var transform = new Transform(this.config);
        if(this.config.objectMode) buffered=false;
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
        rawPipe.call(this._currentStream, transform);
        if(!bypass)this._currentStream =transform;
    }
    else {

        rawPipe.call(this._currentStream, dest);
        if(dest.readable&&!bypass) {
            this._currentStream = dest;
        }
    }
    return this;
};
/**
 * 分流stream
 * */
ReadyStream.prototype.bypass=function(dest,buffered){
    return this.pipe(dest,buffered,true);
};
/*
* 写入文件数据 这是一个异步的写操作
* 如果多次调用此方法 后续的写操作只有在上一个文件全部写入后才会执行
* */
ReadyStream.prototype.writeFile = function(path,config,manualEnd) {
    this.inflow(Fs.createReadStream(path,config),manualEnd);

};
ReadyStream.prototype.inflow=function(readableStream,manualEnd){
    readableStream.pipe(this,manualEnd?{end:false}:undefined);
};
/*
* 异步写数据操作
* 异步写操作会等待之前所有的异步写操作完成之后才会写入 
* 如果之前没有异步写操作 则会立即（同步）写入数据
* */
ReadyStream.prototype.put = function(data) {
    if(data===null||data===undefined){
        return null;
    }
    if(typeof data.doWrite === 'function') {
        var writeRequest=data;
    }
    else {
        writeRequest=new DataWriteRequest(data);
    }
    if(this._writing) {
       this._writeRequest.push(writeRequest);
    }
    else{
        this._writing=true;
        writeRequest.doWrite(this);
    }

};
ReadyStream.prototype.end = function(chunk, encoding, cb) {
    if(!this._writing) {
        rawEnd.call(this, chunk, encoding, cb);
    }
    else {
        this._end = {
            chunk    : chunk,
            encoding : encoding,
            cb       : cb
        };
        if(this._writingSource) {
            if(this._writingSource._readableState.ended) {
                //没有待写入的
                this.drain();
            }
        }
        else{
            this.drain();
        }

    }
};
ReadyStream.prototype.drain = function() {
        var writeRequest = this._writeRequest.shift();
        if(writeRequest) {
            writeRequest.doWrite(this);
        }
        else {
            this._writing=false;
            if(this._end){
                this.end(this._end.chunk, this._end.encoding, this._end.cb);
            }
        }
};
function _serializeData(data){
    if(typeof data=='object'){
        if(!Buffer.isBuffer(data)){
            return JSON.stringify(data);
        }
        else {
            return data;
        }
    }
    else if(data!==undefined&&data!==null){
        return data.toString();
    }
    else {
        return "";
    }
}


function DataWriteRequest(data){
    if(data===undefined||data===null){
        return null;
    }
   this.data=_serializeData(data);
}
DataWriteRequest.prototype.doWrite=function(readyStream){
    readyStream.write(this.data);
    //fixme 是否要使用nextTick做成异步的
    readyStream.drain();
};
function StreamWriteRequest(stream){
    this.stream=stream;
}
StreamWriteRequest.prototype.doWrite=function(readyStream){
    readyStream._writing=true;
    readyStream._writingSource=this.stream;
    this.stream.resume();
};


module.exports = function(config,transform){
    return new ReadyStream(config,transform);
};


