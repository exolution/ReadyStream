
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
function ReadyStream() {
    //it's a transform stream
    // 继承于transform类
    Transform.call(this);
    //write Request queue for ensure the sequence of sync write operation
    //写请求队列  用来确保一系列异步写操作的顺序性
    this._writeRequest = [];
    //whether a sync write operation in progress
    //是否正在执行写操作
    this._writing = false;
    //delayed end
    //延迟的end信息 当前stream有异步的写入操作（如writeFile）此时不能立即执行end需要等所有的异步写入操作都完成后再执行end
    this._end = null;
    //实际上它本身是一系列transform流的链 它内部永远保存最新流经的transform流的引用
    //in fact,it's a chain of transform stream.it hold the latest transform stream which data flowed in
    this.currentStream = this;

}
Util.inherits(ReadyStream, Transform);

//implement _transform
ReadyStream.prototype._transform=function(chunk, encoding, next) {
    this.push(chunk);
    next();
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
        var transform = new Transform();
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
        if(!bypass)this.currentStream =transform;
    }
    else {

        rawPipe.call(this.currentStream, dest);
        if(dest.readable&&!bypass) {
            this.currentStream = dest;
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
ReadyStream.prototype.writeFile = function(path,config) {
    this.inflow(Fs.createReadStream(path,config));

};
ReadyStream.prototype.inflow=function(readableStream){
    this._writeRequest.push(new StreamWriteRequest(readableStream));
    this.doWrite();
};
/*
* 异步写操作
* 异步写操作会等待之前所有的异步写操作完成之后才会写入
* */
ReadyStream.prototype.syncWrite = function(data) {
    if(typeof data.doWrite==='function'){
        this._writeRequest.push(data);
    }
    else {
        this._writeRequest.push(new DataWriteRequest(data));
    }
    this.doWrite();
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
        }
    }
};
ReadyStream.prototype.doWrite = function() {

    if(!this._writing) {
        var writeRequest = this._writeRequest.shift();
        if(writeRequest) {
            writeRequest.doWrite(this);
        }
        else if(this._end){
            rawEnd.call(this, this._end.chunk, this._end.encoding, this._end.cb);
        }
    }
};
function _serializeData(data){
    if(typeof data=='object'){
        if(!Buffer.isBuffer(data)){
            return JSON.stringify(data);
        }
    }
    else if(data!==undefined&&data!==null){
        return data.toString();
    }
    else {
        return "";
    }
}

function StreamWriteRequest(stream){
    if(stream.readable) {
        this.stream = stream;
    }
    else{
        new Error("can't write an unreadable stream");
    }
}
StreamWriteRequest.prototype.doWrite=function(readyStream){
    readyStream._writing=true;
    this.stream.pipe(this, {
        end : false
    });
    this.stream.on('end', function() {
        readyStream._writing=false;
        //fixme 是否要使用nextTick做成异步的
        readyStream.doWrite();
    })
};
function DataWriteRequest(data){
   this.data=_serializeData(data);
}
DataWriteRequest.prototype.doWrite=function(readyStream){
    readyStream.write(this.data);
    //fixme 是否要使用nextTick做成异步的
    readyStream.doWrite();
};
var RS=module.exports = function(data){
    var stream= new ReadyStream();
    if(data.readable){
        stream.inflow(data);
    }
    else{
        stream.write(_serializeData(data));
    }
    return stream;
};

var rs=new RS("helloworld");
rs.syncWrite({a:1});
rs.pipe(function(chunk,enc,done){
   this.push("before1\n");
    this.push(chunk);
    this.push("after1\n");
    done();
},true);
rs.pipe(Fs.createWriteStream('./out1.txt'));
rs.pipe(function(chunk,enc,done){
    this.push("before2\n");
    this.push(chunk);
    this.push("after2\n");
    done();
},true);
rs.syncWrite("hhh");
rs.pipe(process.stdout);
rs.pipe(Fs.createWriteStream('./out.txt'));

rs.end();
setTimeout(function(){
},1000)


