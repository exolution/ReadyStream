/**
 * Created by godsong on 15-12-18.
 */

var Http=require('http');
var Url=require('url');
var ReadyStream=require('../ReadyStream.js');
//HttpWriteRequest类
// 名字随意取，其实更建议易懂的名字，比如HttpData。
// 只要包含doWrite方法即可

var HttpData=ReadyStream.WriteRequest.implement({
    constructor:function HttpData(url){
        this.url=url;
    },
    doWrite:function(readyStream){
        var urlObj = Url.parse(this.url);
        var request = Http.request({
            host:urlObj.hostname,
            method  : 'get',
            path    : urlObj.path,
            port    : urlObj.port || 80
        }, function(res) {
            res.on('data', function(chunk) {
                //请求到数据之后写到readyStream里
                readyStream.put(chunk);
            });
            res.on('end', function() {
                if(res.statusCode == 200) {
                    //http数据读完了
                    //结束当前的数据写入
                    //由于是异步的所以 不end的话 我就不知道你什么时候结束，
                    //所以必须在你认为异步结束的时候执行.end
                    readyStream.end();
                }
            });
        });
        request.end();
    }
});
//实现doWrite方法
var stream=new ReadyStream();
stream.put(new HttpData('http://www.jd.com/robots.txt'));
stream.put("end");
stream.writeFile('./in2.txt');
stream.pipe(process.stdout);
