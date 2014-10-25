mfetips
=======

mobile frontend tips


##mbug Mbug is a bug list for front-end development of mobile

### #1 页面高度渲染错误

   问题描述：页面100%高度包含地址栏高度，当地址栏存在时，会部分内容被隐藏
 环境与频率：经常性出现;各移动浏览器
   解决办法：重置<html>高度：document.documentElement.style.height = window.innerHeight + 'px'
 
### #2 叠加区高亮

   问题描述：使用click也会出现绑定点击区域闪一下的情况
 环境与频率：部分android机型
   解决办法：给该元素一个样式 -webkit-tap-highlight-color:Ωrgba(0,0,0,0);
   
### #3 事件无法被触发

   问题描述：focus、touch、click等事件均无效
 环境与频率：android微信 部分机型
   解决办法：该元素其CSS属性里增加 -webkit-transform: translate3d(0,0,0) 
   
### #4 :active 效果不兼容

   问题描述：CSS active伪类无效
 环境与频率：android 4.2以下
   解决办法：该元素的touch系列的事件绑定一个空匿名方法
   <pre>
   element.addEventListener('touchstart',function(){},false);
   </pre>
   
### #5 浏览器崩溃

   问题描述：解绑函数写在了事件处理中导致微信崩溃
 环境与频率：小米微信
   解决办法：解绑事件不要写在事件处理中

### #6 预加载与自动播放无效

   问题描述：audio的preload、autoplay 无法直接起效
 环境与频率：受操作系统、浏览器（webview）、版本等影响
   解决办法：捕捉一次用户输入后，让音频加载实现预加载
   <pre>
   //play and pause it once
   document.addEventListener('touchstart', function () {
   document.getElementsByTagName('audio')[0].play();
   document.getElementsByTagName('audio')[0].pause();
   });
   </pre>

### #7 无法同时播放多音频

   问题描述：播放后一音频会打断前一音频，而不会同步播
 环境与频率：android
   解决办法：合理降权与选择不同的音频，不同音频营造尽量一致的氛围。

### #8 不支持局部滚动

   问题描述：除body(html)元素外 overflow:scroll 无效
 环境与频率：android 2.X
   解决办法：1、巧用布局 利用body(html)全局滚动
             2、iscroll、自写js控制translate、scrollTop模拟

### #9 input:password 密码输入框出现悬浮怪异输入框

   问题描述：怪异悬浮的表单
 环境与频率：部分android机型
   解决办法：使用input:text类型而非password类型，并设置其设置 -webkit-text-security: disc; 隐藏输入密码从而解决。

