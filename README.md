# watInterpreter
watInterpreter can parse and execute wat (text representaion of wasm) files. This project is mainly just for fun.

there is included polyfill for an es5 conversion with babel compiler

Goto here to compile some code :)
https://webassembly.studio/

# example

```js
var watInterpreter = require('./watInterpreter.js'),
    fs = require('fs'),
    file = fs.readFileSync('input/read.wat', 'utf8'),
    _module = new watInterpreter().Module(file, {imports: {
        printMessage(arr, string){
            console.log(arr, string)
        }
    }});
console.log(_module);
```

# other

watInterpreter also includes certain type expantion. 
Such as the ``vec_str`` and ``vec_arr`` instructions.

# images

![Image](https://i.imgur.com/G86ABK6.png)

![Image](https://i.imgur.com/13I5JI6.png)

### loops
![Image](https://i.imgur.com/EVAzNH8.png)

![Image](https://i.imgur.com/fT759MF.png)
