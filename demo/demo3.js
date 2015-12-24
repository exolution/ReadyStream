/**
 * Created by godsong on 15-12-18.
 */
var ReadyStream=require('../ReadyStream');
var UglifyJS = require("uglify-js");
var Fs=require('fs');
var Path=require('path');

//主要功能：
//把当前文件夹下的js合并压缩成一个文件 并同时保存一个未压缩的版本

var DelayedData=ReadyStream.WriteRequest.implement({
    constructor:function(data,delay){
        this.data=data;
        this.delay=delay;
    },
    doWrite:function(readyStream){
        var self=this;
        setTimeout(function(){
            readyStream.put(self.data);
            readyStream.end();
        },this.delay);
    }
});
var DirFile=ReadyStream.WriteRequest.implement({
    constructor:function(path,ext){
        this.path=path;
        this.ext='.'+ext;
    },
    doWrite:function(readyStream){
        var self=this;
        Fs.readdir(this.path,function(err,files){
            //遍历当前文件夹
            files.forEach(function(file){
                if(Path.extname(file)===self.ext) {
                    //写入文件 且每个文件开头加上文件名注释
                    readyStream.put('\n/*========file:' + file + '========*/\n');
                    readyStream.writeFile(file);
                    readyStream.put(new DelayedData("\n等待1秒",1000));
                }
            });
            readyStream.end();
        });
    }
});
var stream=new ReadyStream();
stream.put(new DirFile('./','js'));
stream.put('//end');
//分流写入文件 保存一个未压缩版本
stream.pipe(Fs.createWriteStream("./pack.js"));
stream.pipe(function(chunk,encoding,next){
    //压缩处理
    this.push(UglifyJS.minify(chunk.toString(), {fromString: true}).code);
    next()
},true);
//分流写入文件，保存压缩版本
stream.pipe(Fs.createWriteStream("./pack.min.js"));
//结束
stream.end();
