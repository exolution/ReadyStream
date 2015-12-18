# ReadyStream
一个简单好用的数据流封装

##什么是流(Stream)?
（已经了解stream的可以跳过这一段扯淡）    
首先，流是一种关于【数据传输和流动】的抽像。早在unix时代，流的概念就已经深入人心，    
因为流的概念可以很完美的描述数据的输入，加工，输出，   
并且很好地处理这些环节中遇到的问题。（比如对大尺寸数据的处理，比如对于加工和消费之间不同步的处理）  
所以后来的所有语言几乎都支持基于流的IO操作。  
Node.js中固然也不例外，Node.js中共包含4种基础流  
Readable 可读流 如读取文件时的FileReadStream  
Writable 可写流 如大家所熟知的HttpResponse  
Duplex 双向流 即可读又可写的流 如网络通信中的socket  
Transform流(又叫through流) 运输流或者说加工流 这个其实才是非常有用的东西 但是对于他的教程非常少  
gulp的数据处理基本上就是基于这个流 这个流是可读写 可以形象的描述数据流从它内部流过，便于你对数据进行加工处理  

我的ReadyStream就是对这transform流的一种封装  

#什么是ReadyStream
（想快速上手使用的可以跳过这段扯淡）
ReadyStream是一个链式Transform流封装。提供非常方便的流操作，
诸如写入文件，异步写入数据，pipe到加工函数，预缓存流数据等。
为什么要是链式的？正常情况下一个readable.pipe(dest) 引流到另外一个stream之后 你想继续pipe就只能在dest上pipe
而ReadyStream会保持最后一个dest的引用，每次pipe是在基于最后这个dest，所以可以针对这一个stream一路pipe管子接到死,当然也同时保留并联pipe的能力（我这里称之为分流bypass）
然而这有什么用呢？想来想去其实场景并不多，一般用于框架中需要暴露一个单例的stream给用户（开发者）。而这个stream又可能经过一系列的管子处理，
如果用传统pipe就没办法一直基于这个stream进行处理。
在我的MVC框架中，我使用ReadyStream代替了http response，是因为response是个writable 只能写数据 而无法pipe进行处理。
所以我将ReadyStream暴露给用户可以让用户方便的进行数据写入和处理，而且上面也说了，链式让readystream可以以单例的形式存在，
因此在各个阶段，你只需要处理它就够了（比如在经过了业务中间件之后，后续的中间件都可以基于这一个readyStream进行如gzip之类的数据加工 ）

#如何使用
```javascript

//这样创建一个空的ReadyStream
var stream=new ReadyStream();
//创建一个文件作为数据源的的ReadyStream
var stream=new ReadyStream(fs.createFileReadStream('./in.txt'));
//创建一个字符串作为数据源的ReadyStream
var stream=new ReadyStream("hello");
//创建一个对象作为数据源的ReadyStream 因为stream只接受buffer数据 对象会被序列化成JSON串
var stream=new ReadyStream("hello");

```
