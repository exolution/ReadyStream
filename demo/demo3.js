/**
 * Created by godsong on 15-12-18.
 */
var ReadyStream=require('../ReadyStream');
var UglifyJS = require("uglify-js");
var Fs=require('fs');
var Path=require('path');

//主要功能：
//把当前文件夹下的js合并压缩成一个文件 并同时保存一个未压缩的版本

var stream=new ReadyStream();
Fs.readdir('./',function(err,files){
    //遍历当前文件夹
    files.forEach(function(file){
        if(Path.extname(file)==='.js') {
            //写入文件 且每个文件开头加上文件名注释
            stream.put('\n/*========file:' + file + '========*/\n');
            stream.writeFile(file);
        }
    })
});
//分流写入文件 保存一个未压缩版本
stream.pipe(Fs.createWriteStream("./pack.js"));

stream.pipe(function(chunk,encoding,next){
    //压缩处理
    this.push(UglifyJS.minify(chunk.toString(), {fromString: true}));
    next()
},true);;
//分流写入文件，保存压缩版本
stream.pipe(Fs.createWriteStream("./pack.min.js"));
