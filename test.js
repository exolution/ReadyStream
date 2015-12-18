/**
 * Created by godsong on 15-12-16.
 */
var Readable=new require('stream').Readable;
var Util=new require('util');
function StringStream(string){
    Readable.call(this);
    this.buffer=new Buffer(string);
}
Util.inherits(StringStream,Readable);
StringStream.prototype._read=function(){
    this.push(this.buffer);
    this.push(null);
};


var stream=new StringStream("奏事这么屌");
stream.pipe(process.stdout);