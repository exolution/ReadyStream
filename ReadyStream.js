/**
 * Created by godsong on 15-12-16.
 */
/**
 * Created by godsong on 15-5-4.
 */
var Transform = require('stream').Transform;
var Readable = require('stream').Readable;
var Writable = require('stream').Writable;
var Util = require('util');
var Fs = require('fs');
var Http = require('http');
var EventEmitter = require('events').EventEmitter;
var rawPipe = Readable.prototype.pipe;
var rawEnd = Writable.prototype.end;
var slice = Array.prototype.slice;


//A transform stream as avatar of HttpServerResponse
//A extended pipe() you can pipe to a function as stream resolver(wrap by a Transform Stream)
//Piped stream while linked in readystream
function ReadyStream(response, config) {
    if(!(this instanceof ReadyStream)) {
        return new ReadyStream();
    }

    //it's a transform stream
    Transform.call(this);
    this._transform = function(chunk, encoding, next) {
        this.push(chunk);
        next();
    };
    this.timestamp=process.hrtime();
    this._writeReq = [];
    this._writing = false;
    this._end = null;
    //stream link
    // because readystream need to tranfered between filters
    // so piped always linked to itself
    this.currentStream = this;

    //save the HttpServerResponse
    this._response = response;
    //just pipe to response once
    this._responsed = false;
    //hack for response's "finished" property
    this.finished = false;
    Object.defineProperties(this, {
        'statusCode' : {
            enumerable : true,
            set        : function(v) {
                response.statusCode = v;
            },
            get        : function() {
                return response.statusCode;
            }
        },
        '_headers'   : {
            enumerable : true,
            set        : function(v) {
                response._headers = v;
            },
            get        : function() {
                return response._headers;
            }
        }
    })
}
Util.inherits(ReadyStream, Transform);


ReadyStream.prototype.response = function() {
    this.pipe(this._response);
};
//老方法 准备废弃
ReadyStream.prototype.join = function(files) {
    var readyStream=this;
    files.forEach(function(file){
        readyStream.writeFile(file);
    })

};
//高能预警！这是本类的核心
//扩展的pipe
//可以把流pipe到一个函数里 这个函数左右流的加工函数（实际上这个函数会被封装成transform stream）
//buffered变量为true时 会buffer所有的流数据 一次性调用这个加工函数
// 否则 可能会调用多次（流本身就不是一次性写完的）
ReadyStream.prototype.pipe = function(dest, buffered) {
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
        this.currentStream = transform;
    }
    else {
        if(dest instanceof Http.ServerResponse) {

            if(!this._responsed) {
                rawPipe.call(this.currentStream, dest);
                this._responsed = true;
            }
            else {
                return this;
            }
        }
        else {
            rawPipe.call(this.currentStream, dest);
        }
        if(dest.readable) {
            this.currentStream = dest;
        }

    }
    return this;
};
ReadyStream.prototype.writeFile = function(path) {
    this._writeReq.push({
        type : 'file',
        path : path
    });
    if(!this._writing) {
        this._writing = true;
        this.doWriting();
    }

};

ReadyStream.prototype.syncWrite = function(data) {
    switch(typeof data) {
        case 'object':
            if(!Buffer.isBuffer(data)) {
                data = JSON.stringify(data);
            }
            break;
        case 'number':
            data = data + '';
            break;
    }
    this._writeReq.push({
        type : 'data',
        data : data
    });
    if(!this._writing) {
        this.doWriting();
    }
};
ReadyStream.prototype.end = function(chunk, encoding, cb) {
    console.trace('end',this._writing);
    if(!this._writing) {
        var delay=process.hrtime(this.timestamp);
        console.log('delay:',delay[0]>0?delay[0]+'s'+' '+(delay[1]/10e5).toFixed(3)+'ms':(delay[1]/10e5).toFixed(3));
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
ReadyStream.prototype.doWriting = function() {

    var readyStream = this;
    var entry = this._writeReq.shift();
    if(entry) {
        if(entry.type === 'file') {
            var file = Fs.createReadStream(entry.path, {highWaterMark : 40});
            file.pipe(this, {
                end : false
            });
            file.on('end', function() {
                readyStream._writing = false;
                readyStream.doWriting();
                entry = null;
            })
        }
        else if(entry.type === 'data') {
            this.write(entry.data);
            this._response.write('B');
            this.doWriting();
        }
    }
    else {
        console.log(2222)
        if(this._end) {
            var delay=process.hrtime(this.timestamp);
            console.log('delay:',delay[0]>0?delay[0]+'s'+' '+(delay[1]/10e5).toFixed(3)+'ms':(delay[1]/10e5).toFixed(3));
            rawEnd.call(this, this._end.chunk, this._end.encoding, this._end.cb);
        }
    }
};

ReadyStream.prototype.writeHead = function(code, reason, headers) {
    this._response.writeHead(code, reason, headers);
};
ReadyStream.prototype.setHeader = function(name, value) {
    this._response.setHeader(name, value);
};
ReadyStream.prototype.getHeader = function(name) {
    return this._response.getHeader(name);
};
ReadyStream.prototype.removeHeader = function(field) {
    this._response.removeHeader(field);
};
module.exports = ReadyStream;

function sequence(files, dest) {
    var file = files.shift();
    var stream = Fs.createReadStream(file);
    if(files.length > 0) {
        stream.pipe(dest, {end : false});
        stream.on('end', function() {
            sequence(files, dest);
        })
    }
    else {
        stream.pipe(dest);
    }
}

/*var rs = new ReadyStream(process.stdout);
 rs.writeFile('./test2.js');
 rs.syncWrite('\n111\n');
 rs.writeFile('./test.js');
 rs.pipe(function(chunk, enc, done) {
 this.push('before');
 this.push(chunk);
 this.push('after');
 done();
 }, true);
 rs.syncWrite('hahaha');
 rs.end();
 rs.response();*/

