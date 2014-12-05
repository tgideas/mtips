# copy latest xo code
cp -rf ../../xsin/xo/dist/** assets/xo/

# copy latest codemirror
mkdir -p assets/codemirror/mode/
mkdir -p assets/codemirror/theme/
cp -rf ../../js/CodeMirror/lib/ assets/codemirror/lib/
cp -rf ../../js/CodeMirror/mode/css/ assets/codemirror/mode/css
cp -rf ../../js/CodeMirror/mode/javascript/ assets/codemirror/mode/javascript
cp -rf ../../js/CodeMirror/mode/htmlmixed/ assets/codemirror/mode/htmlmixed
cp -rf ../../js/CodeMirror/mode/xml/ assets/codemirror/mode/xml
cp -rf ../../js/CodeMirror/theme/monokai.css assets/codemirror/theme/
