var ReadyStream=require('./ReadyStream');
var Fs=require('fs');

var stream=new ReadyStream();
//往流中写入一个文件
stream.writeFile("./in.txt");//文件内容为"hello"
//写文件是一种异步的写操作，
//异步的写操作会等之前所有的异步写操作完成之后才会开始写入数据
//所以in2.txt会在in.txt全部写入后才开始写入
stream.writeFile("./in2.txt");//文件内容为" world"

//因为readyStream本身也是一个标准的transform流所以也可以用这种方式写入文件
//一样会等前边的异步写入完成之后开始写入
var input=Fs.createReadStream('./in3.txt');//文件内容为 " readystream\n"
input.pipe(stream);
//也可以用stream.inflow(input)性质一样
//往流中写入数据
//put会等待之前所有的异步写入操作完成之后才开始写入，
//如果之前没有异步写操作 则会立即（同步）写入
//所以"hahaha"会等in.txt和 in2.txt都全部写入之后才会写入
//另外 put也可以写入异步数据 下文会介绍
stream.put("hahaha\n");

//同步写入数据 这个是writable的原生方法 只允许写入buffer类型或者string
//由于是同步写入数据 会在所有异步写入之前写入
//强烈不推荐这种方式写入，保留它是因为这是一个stream必须的方法。请尽量使用put
stream.write("sync\n");

//处理加工数据-串行接水管
stream.pipe(function(chunk,encoding,next){
    //[chunk]:数据块(是一个buffer)[encoding]:数据的编码[next]:执行下一步的回调函数
    //这个函数就是数据的加工函数(第一个管子)
    //下面buffered参数为false（可以缺省不写）也就是说不积蓄数据，上面对流的每一次write都会调用这个函数
    //（writeFile根据文件的大小和设置的读取缓冲大小可能会有多次write）
    this.push(chunk);//写出数据 把加工好（当然这里是原样写出了，没加工）的数据流出这个管子（传到下一个管子或者传到输出流）
    next();//next 这个非常重要只有执行next才会加工下一个数据块 为啥要有next 因为你加工数据的过程可能是个异步的,所以你需要在异步过程完成之后才调用next

},false/*buffered*/);
stream.pipe(function(chunk,encoding,next){
    //这个函数就是数据的加工函数（第二个管子）
    //下面的bufferd参数为true 表示积蓄数据，会等前面所有的写入操作完成之后才会执行这个函数
    //重点：只有主动调用stream.end() readyStream才知道所有的写入完成，才会执行这个函数 否则会一直等待
    this.push("before\n");//在原数据之前写出数据
    this.push(chunk);
    this.push("after\n");//在原数据之后写出数据
    next();
},true);
//结束流 如果前面还有未执行完的异步写入操作 会等所有异步写入操作都完成后才执行
//结束一个流之后就不能再往里面写入数据了
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

