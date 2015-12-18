/**
 * Created by godsong on 15-12-18.
 */
var ReadyStream=require('../ReadyStream');
var Fs=require('fs');
var Path=require('path');
var stream=new ReadyStream();
Fs.readdir('./',function(err,files){
    console.log(files);
    files.forEach(function(file){
        if(Path.extname(file)==='.js') {
            stream.put('\n/*========file:' + file + '========*/\n');
            stream.writeFile(file);
        }
    })

});

stream.pipe(Fs.createWriteStream("./pack.js"));
stream.pipe(function(){

},true);
stream.pipe(Fs.createWriteStream("./pack.min.js"));
