# ReadyStream
一个简单易用的数据流封装，让你快速运用stream的强大威力。

##什么是流（What is Stream?）
（已经了解stream的可以跳过这一段啰嗦）  

首先，流是一种关于【数据传输和流动】的抽像。早在unix时代，流的概念就已经深入人心，    
因为流的概念可以很完美的描述数据的输入，加工，输出，并且很好地处理这些环节中遇到的问题。（比如对大尺寸数据的处理，比如对于加工和消费之间不同步的处理）  
所以后来的所有语言几乎都支持基于流的IO操作。Node.js中固然也不例外，Node.js中共包含4种基础流  
* Readable 可读流 如读取文件时的FileReadStream  
* Writable 可写流 如大家所熟知的HttpResponse  
* Duplex 双向流 即可读又可写的流 如网络通信中的socket  
* Transform流(又叫through流) 运输流或者说加工流 这个其实才是非常有用的东西。因为在咱们编程的过程中输入流和输出流系统都有提供，咱们最需要实现的就是对数据进行加工的逻辑。gulp的数据处理基本上就是基于这个流 这个流是可读写的，可以形象的描述数据流从它内部流过，便于你对数据进行加工处理。  

`我的ReadyStream就是对这transform流的一种封装`  

##为什么要用ReadyStream （Why tree newbie?）
（讨厌吹牛逼的可以跳过这一段广告）
####※上手简单
ReadyStream 将整个数据相关的业务流程抽象成 [写入]-[处理加工]-[保存]的模式。让你迅速的体验基于stream开发的快感，并且通过对异步写入的封装，引导让你写出更清晰的程序结构。
####※强大的异步写入/流入
ReadyStream对写入操作做了封装，归一化同步写入还是异步写入。写入操作会自动按顺序依次写入，无论是同步的还是异步的（如写入一个文件）。 
也就是说自动帮你管理前一个写入操作完成后才会执行后续的写入操作。而你只需要写同步风格的代码即可。

####※简单好用的加工处理
ReadyStream可以很方便的引流(pipe)到一个数据加工函数里。而且可以根据需要帮你积蓄数据，一次性给你。  
（正常情况下，流肯定是写一点给一点，加工函数会调用多次。积蓄是指等所有的写入都完成，一次性给到加工函数里，加工函数只会调用一次。
####※完全可以用ReadyStream做一个gulp
没有噱头，没人关注呀~  
其实我的ReadyStream也并非是为了让你重复造个gulp轮子的。  
而是更好地在自己的项目中运用流的力量  

#什么是ReadyStream？（What ghosts?）
（想快速上手使用的可以跳过这段扯淡）  

ReadyStream是一个链式Transform流封装。提供非常方便的流操作。   
诸如`写入文件`，`异步写入数据`，`pipe到加工函数`，`预缓存流数据`等。  
######为什么要是链式的？  
正常情况下一个可读流通过readable.pipe(dest) 引流到另外一个stream之后 你想继续pipe就只能在这个另外的流(dest)上pipe。
而ReadyStream则会保持最后一个dest的引用，每次pipe是在基于这个readystream的dest引用，所以可以针对这一个readystream 实例一路pipe管子接到死,当然也同时保留并联pipe的能力（我这里称之为分流bypass）  
######然而链式有什么用呢？
想来想去其实场景并不多（囧rz），一般用于框架中需要暴露一个单例的stream给用户（开发者）。而这个stream又可能经过一系列的管子进行处理，如果用传统pipe就没办法一直基于这个stream进行处理，你必须像接力一样一路追踪下去。  
在我的MVC框架中，我使用ReadyStream代替了http response，是因为response是个writable只能写数据，而无法pipe进行处理。  
所以我将ReadyStream暴露给用户可以让用户方便的进行数据写入和处理，而且上面也说了，链式让readystream可以以单例的形式存在，
因此在各个阶段，无论是开发者还是我的框架只需要处理这个统一的readystream实例就够了。例如在经过了业务中间件之后，后续的中间件都可以基于这一个readyStream进行数据加工(如gzip)   

#如何使用？（How to play?）

####安装
npm install ready-stream

#####创建ReadyStream
```javascript

//这样就创建了一个空的ReadyStream
var stream=new ReadyStream();
//其实ReadyStream接收两个参数，一般用不上。
//而且需要你对stream系统有比较深的了解。如流本身的_transform和ObjectMode等配置
//如有需要请看源码
```
#####写入数据

```javascript 
//写入一个文件
stream.writeFile("./in.txt");//文件内容为"hello"
```

写文件是一种异步的写操作，  
异步的写操作会等之前所有的异步写操作完成之后才会开始写入数据  
所以in2.txt会在in.txt全部写入后才开始写入  
```javascript 
stream.writeFile("./in2.txt");//文件内容为" world"
```

因为readyStream本身也是一个标准的transform流所以也可以用这种方式写入文件  
 一样会等前边的异步写入完成之后开始写入

```javascript 
var input=Fs.createReadStream('./in3.txt');//文件内容为 " readystream\n"
input.pipe(stream);//也可以用stream.inflow(input)性质一样
```
######往流中写入数据
put会等待之前所有的异步写入操作完成之后才开始写入，  
如果之前没有异步写操作 则会立即（同步）写入  
所以"hahaha"会等in.txt和 in2.txt都全部写入之后才会写入  
另外 put也可以写入封装好的异步数据 下文会重点介绍  
```javascript
stream.put("hahaha\n");

/*
 * 同步写入数据 这个是writable的原生方法 只允许写入buffer类型或者string
 * 由于是同步写入数据 会在所有异步写入之前写入
 * 强烈不推荐这种方式写入，保留它是因为这是一个stream必须的方法。请尽量使用put
 */
stream.write("sync\n");
```
#####处理加工数据-串联接水管
```javascript
stream.pipe(function(chunk,encoding,next){
    //[chunk]:数据块(是一个buffer)[encoding]:数据的编码[next]:执行下一步的回调函数   
    
    /*
     * 这个函数就是数据的加工函数(第一个管子)
     * 下面buffered参数为false（可以缺省不写）也就是说不积蓄数据，上面对流的每一次write都会调用这个函数
     *（writeFile根据文件的大小和设置的读取缓冲大小可能会有多次write）
     */
    
    //写出数据 把加工好（当然这里是原样写出了，没加工）的数据流出这个管子（传到下一个管子或者传到输出流）
    this.push(chunk);
    /*
     * next 这个非常重要只有执行next才会加工下一个数据块 
     * 为啥要有next 因为你加工数据的过程可能是个异步的,所以你需要在异步过程完成之后才调用next
     */
    next(); 

},false/*buffered*/);
stream.pipe(function(chunk,encoding,next){
    //这个函数就是数据的加工函数（第二个管子）
    /*
     * 下面的bufferd参数为true 表示积蓄数据，会等前面所有的写入操作完成之后才会执行这个函数
     * 重点：只有主动调用stream.end() readyStream才知道所有的写入完成，才会执行这个函数 否则会一直等待
     */
    
    this.push("before\n");//在原数据之前写出数据
    this.push(chunk);
    this.push("after\n");//在原数据之后写出数据
    next();
},true/*buffered*/);


/*
 * 结束流 如果前面还有未执行完的异步写入操作 会等所有异步写入操作都完成后才执行
 * end表示你要结束整个流的写入，结束一个流之后就不能再往里面写入数据了 
 */
stream.end();

// 最终把流接到输出流中 本例是接入到终端输出 把之前的内容显示在屏幕上
stream.pipe(process.stdout);
/*结果：
before
sync
hello world ready stream
hahaha
after
 */
```
#####并联接水管（我更喜欢称之为分流）
指定pipe的第三个参数为true打开分流模式，或者直接使用.bypass代替.pipe  
分流模式实际上就是指并联的接水管，下图会详细说明 
![abc](http://77fkpo.com5.z0.glb.clouddn.com/73e5505c8919b92cf9693bfe8854d032.png)

#### put 异步数据
这个是我重点设计的地方，也是前面所说的引导开发者写出良好代码结构。（所以扯得多一些，希望多关注这一部分）  
如果你想往流中写入的数据，并不是简单的直接数据，需要一系列的操作来获得的(比如需要请求一个url得到这个数据)。      
那么我建议把这种数据封装成`异步数据`，也就是把这种读取数据的过程抽象成一种数据，把它直接put到流中的。  
为什么要这样呢？因为要`关注点分离`！把这种异步的一系列对readystream的操作单独封装起来，剥离出主要的代码结构。能够避免代码分散到各个的异步回调变得支离破碎。这其实是一种层次上的分离，实际上所谓的`异步数据`封装也是对readystream的操作，只不过我把他们分离到不同的层次中，使得代码结构变得清晰，也几乎能保证，主代码（最外层的代码）完全是同步形式的。  
下面说一下如何创建一个`异步数据`  
首先创建一个能够put的异步数据 需要自己实现WriteRequest接口，其实也就是实现doWrite(readyStream)方法，用来描述你的写入逻辑。  
你只要做一个包含doWrite方法的类就好了，当然我也提供了快速创建这个类的方式ReadyStream.WriteRequest.implement(类定义);

```javascript
var HttpData=ReadyStream.WriteRequest.implement({
    //构造函数
    constructor:function HttpData(url){
        this.url=url;
    },
    resolveRedirectUrl:function(headers){
    //处理重定向的url 篇幅原因这里不写具体实现 请参看demo文件夹下的demo2.js
    },
    //实现doWrite方法
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
                //这就是在这个层次的写入 同样支持写入复杂的数据（如writeFile）或者嵌套另外一个[异步数据]
                readyStream.put(chunk);
            });
            res.on('end', function() {
                if(res.statusCode == 200) {
                    //http数据读完了
                    //结束当前的数据写入
                    //由于是异步的所以 不end的话 我就不知道你什么时候结束，
                    //所以必须在你认为异步结束的时候执行.end
                    //这也是我所说的一个【异步数据】封装的就是一个完整的对readyStream写入的代码层次，
                    //在这个层次你当然要在合适的时候告诉我写入完成了
                    readyStream.end();
                }
                else if(res.statusCode==302||res.statusCode==301){
                    //处理重定向
                     var urlObj=self.resolveRedirectUrl(res.headers);
                    //这就是我说的层次分离，在一个【异步数据】中可以put另外一个异步数据（相当于开辟了一个新的层次）
                    //整个代码变得更清晰和更优雅有木有！（这个逼给几分^_^）
                    readyStream.put(new HttpData(urlObj));
                    //当然千万别忘了end
                    readyStream.end();
                }
            });
        });
        request.end();
    }
});


```
上面就是一个异步数据的封装，有了他，那么程序的主要代码结构就变得非常清晰了，基本上全是同步代码。
```javascript
var stream=new ReadyStream();
stream.put(new HttpWriteRequest('http://www.jd.com/robots.txt'));
stream.put("end");
stream.end();
stream.pipe(process.stdout)
```

这样把数据源的行为单独封装，使之与程序的主要数据流转逻辑（用对stream的写入、加工、写出来描述）分离开来，是一种比较好的思路，是关注点分离的简单实现，而关注点分离正是一个优秀架构的行为准则。    
否则，如果主要逻辑以源数据读取为主，对于stream的操作就会分散到各种异步回调中，就像下面的例子，同样实现上述功能

```javascript
var urlObj = Url.parse('http://www.jd.com/robots.txt');
Http.request({
    host:urlObj.hostname,
    method  : 'get',
    path    : urlObj.path,
    port    : urlObj.port || 80,
}, function(res) {
    var stream=new ReadyStream();
    stream.inflow(res);//等同于res.pipe(stream);
    stream.put(res);
    //如果这时候还需要请求异步数据呢 好吧继续嵌套
    Url.parse('http://www.hitour.cc/robots.txt');
    Http.request({
        host:urlObj.hostname,
        method  : 'get',
        path    : urlObj.path,
        port    : urlObj.port || 80,
    }, function(response) {
        stream.inflow(response);
        stream.pipe(process.stdout);
    }).end()
}).end();
```
请对比一下 哪种更清晰。

######实例
到现在说了这么多 可能你还是不知道readyStream有啥用？
那好吧，我就实现一个简单的gulp功能来说明吧
```javascript
var ReadyStream=require('../ReadyStream');
var UglifyJS = require("uglify-js");
var Fs=require('fs');
var Path=require('path');

//主要功能：
//把当前文件夹下的js合并压缩成一个文件 并同时保存一个未压缩的版本


//创建一个延时【异步数据】等待一定时间后才写入数据 （没实际意义只是为了体现异步）
var DelayedData=ReadyStream.WriteRequest.implement({
    constructor:function(data,delay){
        this.data=data;
        this.delay=delay;
    },
    doWrite:function(readyStream){
        var self=this;
        setTimeout(function(){
            readyStream.put(self.data);
            readyStream.end();//别忘了end呦
        },this.delay);
    }
});

//目录文件【异步数据】
var DirFile=ReadyStream.WriteRequest.implement({
    constructor:function(path,ext){
        this.path=path;
        this.ext='.'+ext;//扩展名过滤
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
                    //等待1000ms后再写入下个文件（并插入等待1秒字样）
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
```

####联系作者
如果有什么问题和建议，欢迎来吐槽~~  
吐槽热线：tanhawk#163.com
