/**
 * Created by godsong on 15-12-18.
 */

var Http = require('http');
var Url = require('url');
var ReadyStream = require('../ReadyStream.js');
//HttpWriteRequest类
// 名字随意取，其实更建议易懂的名字，比如HttpData。
// 只要包含doWrite方法即可

var HttpData = ReadyStream.WriteRequest.implement({
    constructor : function HttpData(url) {
        if(typeof url === 'object') {
            this.urlObj = url;
        }
        else {
            this.urlObj = Url.parse(url);
        }
    },
    resolveRedirectUrl:function(headers){
        var redirectUrlObj = Url.parse(headers['Location'] || headers['location']);
        redirectUrlObj.protocol = redirectUrlObj.protocol || this.urlObj.protocol;
        redirectUrlObj.host = redirectUrlObj.host || this.urlObj.host;
        redirectUrlObj.hostname = redirectUrlObj.hostname || this.urlObj.hostname;
        redirectUrlObj.port = redirectUrlObj.port || this.urlObj.port;
        return redirectUrlObj;
    },
    doWrite     : function(readyStream) {
        var self=this;
        var request = Http.request({
            host   : this.urlObj.hostname,
            method : 'get',
            path   : this.urlObj.path,
            port   : this.urlObj.port || 80
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
                else if(res.statusCode == 302 || res.statusCode == 301) {
                    var urlObj=self.resolveRedirectUrl(res.headers);
                    readyStream.put(new HttpData(urlObj));
                    readyStream.end();
                }
            });
        });
        request.end();
    }
});
//实现doWrite方法
var stream = new ReadyStream();
stream.put(new HttpData('http://www.jd.com/robots.txt'));
//stream.put(new HttpData('http://localhost:60001/test/redirect'));
stream.writeFile('./in2.txt');
stream.pipe(process.stdout);
