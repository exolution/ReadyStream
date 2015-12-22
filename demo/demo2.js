/**
 * Created by godsong on 15-12-18.
 */

var Http=require('http');
var Url=require('url');
var ReadyStream=require('../ReadyStream.js');
//HttpWriteRequest类
// 名字随意取，其实更建议易懂的名字，比如HttpData。
// 只要包含doWrite方法即可
function HttpWriteRequest(url){
    this.url=url;
}
//实现doWrite方法
HttpWriteRequest.prototype.doWrite=function(readyStream){
    var urlObj = Url.parse(this.url);
    var request = Http.request({
        host:urlObj.hostname,
        method  : 'get',
        path    : urlObj.path,
        port    : urlObj.port || 80,
    }, function(res) {
        res.on('data', function(chunk) {
            //请求到数据之后写到readyStream里
            //注意这里一定要用同步的write 否则这些数据可能会被延迟写入（如果此前已经有put操作）
            readyStream.write(chunk)
        });
        res.on('end', function() {
            if(res.statusCode == 200) {
                //http数据读完了 关闭写入锁
                //通知readyStream去完成后续的写入任务（吸干 好吧我邪恶了）
                readyStream.drain();
            }
        });
    });
    request.end();
};
var stream=new ReadyStream();

stream.put(new HttpWriteRequest('http://www.jd.com/robots.txt'));
stream.put("end");


stream.pipe(process.stdout);
