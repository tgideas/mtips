XO.View.define({
    pid:'home',
    vid:'index',
    version:'20141114',
    init:function(){
        XO.warn('View inited:'+this.id);
        $(document).on('click','.segmented-control .control-item',function(e){
            var $this=$(this),
                clOn = 'active';
            if($this.hasClass(clOn)){
                return;
            }
            
            var href = this.getAttribute('data-href'),
                $page = $this.parents('.xpage'),
                $items = $page.find('.control-content');
                $navs = $page.find('.control-item');

            $navs.removeClass(clOn);
            $this.addClass(clOn);

            $items.removeClass(clOn);
            $items.eq($this.index()).addClass(clOn);

        });

    },
    //模板已经渲染到页面中
    onRender:function(){
        XO.warn(XO.View.getId(this.pid,this.vid)+':View onRender',this);
    },
    //动画进行中
    onAnimating:function(eventData){
        XO.warn(XO.View.getId(this.pid,this.vid)+':View onAnimating',eventData);
    },
    //动画结束
    onAnimated:function(eventData){
        XO.warn(XO.View.getId(this.pid,this.vid)+':View onAnimated',eventData);
    }
});
