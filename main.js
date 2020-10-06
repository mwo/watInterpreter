var watInterpreter = require('./watInterpreter.js'),
    fs = require('fs'),
    file = fs.readFileSync('input/read.wat', 'utf8'),
    _module = new watInterpreter().Module(file, {imports: {
        printMessage(arr, string){
            console.log(arr, string)
        }
    }});
console.log(_module);
console.log("_module.add(2,5) ->", _module.add(2,5));
