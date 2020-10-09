//for es5 converstions
Array.from = function (arr, mapfn) {
    if (mapfn == undefined) {
        mapfn = function (e) {
            return e
        }
    }
    return JSON.parse(JSON.stringify(arr)).map(mapfn)
}

function _toConsumableArray(arr) {
    return (
        _arrayWithoutHoles(arr) ||
        _iterableToArray(arr) ||
        _unsupportedIterableToArray(arr) ||
        _nonIterableSpread()
    );
}

function _nonIterableSpread() {
    throw new TypeError(
        "Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."
    );
}

function _unsupportedIterableToArray(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _arrayLikeToArray(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(o);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))
        return _arrayLikeToArray(o, minLen);
}

function _iterableToArray(iter) {
    if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter))
        return Array.from(iter);
}

function _arrayWithoutHoles(arr) {
    if (Array.isArray(arr)) return _arrayLikeToArray(arr);
}

function _arrayLikeToArray(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for (var i = 0, arr2 = new Array(len); i < len; i++) {
        arr2[i] = arr[i];
    }
    return arr2;
}

//flats an array of ints to infinity
Array.prototype.flatn = function () {
    return this.map(function (e) {
        return e.constructor.name == "Number" ? [e] : _toConsumableArray(e);
    }).map(function(e){
        return (e.constructor.name == "Array" && e.length == 1) ? +e : e.flatn();
    }).toString().split(',').map(function(e){
        return +e
    })
}
//es5 polyfill end

//class
class watInterpreter {
    constructor(memAloc = 1e4) {
        //memTypeMap
        this.typeMap = {
            string: 1,
            arr: 200,
            arrd: 199,
            arre: 198
        };

        //module
        this._module = {
            _local: {
                main: {}
            },
            _exports: {},
            memory: Array(memAloc),
            stack: [],
            lastl: 0, //last memory location
            acall: [],
            datac: {}
        }

        this.entry_point = false //optional entry point for wat;

        this.getType = a => a.constructor.name.toLowerCase();
        this.memAloc = memAloc;

        //symbols ---------------------------------------------------------------------------------
        var noarg = ["memory.grow","memory.size","nop", "add", "mul", "ge_s", "ge_u", "div_s", "div_u", "sub", "gt_s", "gt_u", "le_s", "le_u", "lt_s", "lt_u", "xor", "eq", "select", "max", "min", "rem_s", "rem_s", "and", "or", "shl", "shr_u", "shr_s", "floor", "rotl", "rotr"],
            sobj = {};
        noarg.forEach(e => sobj[e] = {});

        //instruction symbols
        var funcargs = {
                vec_str: {
                    reg: "\\s(.+)"
                },
                vec_arr: {
                    reg: "\\s(.+)"
                },
                call: {
                    reg: "\\s(\\$.+)"
                },
                const: {
                    reg: "\\s([0-9-]+)"
                },
                get_global: {
                    reg: "\\s(\\$.+)"
                },
                get_local: {
                    reg: "\\s(\\$.+)"
                },
                set_local: {
                    reg: "\\s(\\$.+)"
                },
                tee_local: {
                    reg: "\\s(\\$.+)"
                },
                ...sobj
            },
            fSymbols = Object.keys(funcargs) //all actual instructions


        //compute arg count
        for (let key in funcargs) {
            let obj = funcargs[key];
            if (!obj.overwrite) {
                obj.reg = new RegExp(key + ('reg' in obj ? obj.reg : ''));
            }
            obj.count = obj.reg.toString().split `(`.length - 1;
        }

        //helper funcs
        function topStack(stack) {
            return Array.from([, , ], _ => stack.pop());
        }

        //gay ass bitwise rotate that uses string methods
        let rotater = (a, rn) => (str = a.toString(2), +`0b${(str.slice(-rn%str.length) + str.slice(0,str.length-(rn%str.length))).slice(0,str.length)}`)
        let rotatel = (a, rn) => (str = a.toString(2), t = rn % str.length, +`0b${str.slice(t)+str.slice(0,t)}`)

        function sym(e, stack) {
            let [p1, p2] = topStack(stack),
                res = eval(p2 + e + p1);
            stack.push(res);
        }

        function usym(e, stack) {
            let [p1, p2] = topStack(stack),
                res = Math.abs(eval(p2 + e + p1));
            stack.push(res);
        }

        var _robj = {
            symbols: ["local","type", "module", "func", "memory", "export", "param", "result", "start"],
            symarg: {
                local: /local\s(\$[a-z0-9]+)/,
                type: /type\s(\$\w\d)/,
                result: /result\s([a-z0-9]+)/,
                param: /param\s(\$\w\d)\s([a-z0-9]+)/,
                export: /export\s"(\w+)"/,
                start: /start\s(\d)/
            },
            funcSymbls: { //(instuction functionality) module management
                ["memory.grow"]({memory}){
                    //allocates 8kb to memory
                    memory = memory.concat(Array(1e3))
                },
                ["memory.size"]({stack, memory}){
                    stack.push(memory.size);
                },
                vec_str({stack}, [str]) {
                    stack.push(str.replace(/\s/, '').slice(1,-1));
                },
                vec_arr({stack}, [str]) {
                    stack.push(JSON.parse(str));
                },
                call({_local, stack}, [varname]){
                    let dirs = varname.slice(1).split('.'),
                        cdir = _local;
                    dirs.forEach(e=>{
                        let ret = cdir[e];
                        if (!ret) throw new Error(e + ": Is undefined")
                        cdir=ret;
                    });

                    //brain, sadly can't use Array.from for support reasons ;(
                    let args = [...Array(cdir.length)].map(_=>stack.pop()),
                        ret = cdir.apply(this, args); //call
                    if (ret != undefined) stack.push(ret);
                },
                get_local({
                    stack,
                    _local
                }, [varname], fname) {
                    let [,pindex] = varname.match(/(\d+)/),
                        fargs = _local[fname];
                    stack.push(fargs[pindex]);
                },
                set_local({
                    stack,
                    _local
                }, [varname], fname) {
                    let val = stack.pop(),
                        [,pindex] = varname.match(/(\d+)/),
                        fargs = _local[fname];
                    fargs[pindex] = val;
                },
                tee_local({
                    stack,
                    _local
                }, [varname], fname) {
                    let val = stack.pop(),
                        [,pindex] = varname.match(/(\d+)/),
                        fargs = _local[fname];
                    fargs[pindex] = val;
                    stack.push(val);
                },
                get_global({
                    stack,
                    _local
                }, [vname]) {
                    stack.push(_local[vname]);
                },
                set_global({
                    stack,
                    _local
                }, [vname]) {
                    let val = stack.pop();
                    _local[vname] = val;
                },
                nop() {},
                add({
                    stack
                }) {
                    sym('+', stack);
                },
                sub({
                    stack
                }) {
                    sym('-', stack);
                },
                mul({
                    stack
                }) {
                    sym('*', stack);
                },
                and({
                    stack
                }) {
                    sym('&', stack);
                },
                or({
                    stack
                }) {
                    sym('|', stack);
                },
                xor({
                    stack
                }) {
                    sym('^', stack);
                },
                eq({
                    stack
                }) {
                    sym('==', stack);
                },
                ne({
                    stack
                }) {
                    sym('!=', stack);
                },
                shl({
                    stack
                }) {
                    sym('<<', stack);
                },
                gt_u({
                    stack
                }) {
                    usym('>', stack);
                },
                le_s({
                    stack
                }) {
                    sym('<=', stack);
                },
                le_u({
                    stack
                }) {
                    usym('<=', stack);
                },
                ge_s({
                    stack
                }) {
                    sym('>=', stack);
                },
                lt_u({
                    stack
                }) {
                    usym('<', stack);
                },
                gt_s({
                    stack
                }) {
                    sym('>', stack);
                },
                lt_s({
                    stack
                }) {
                    sym('<', stack);
                },
                rem_s({
                    stack
                }) {
                    sym('%', stack);
                },
                div_s({
                    stack
                }) {
                    sym('/', stack);
                },
                ge_u({
                    stack
                }) {
                    usym('>=', stack);
                },
                //could be wrong order
                shr_u({
                    stack
                }) {
                    sym('>>', stack);
                },
                shr_s({
                    stack
                }) {
                    sym('>>>', stack);
                },
                floor({
                    stack
                }) {
                    stack.push(stack.pop() | 0);
                },
                div_u({
                    stack
                }) {
                    let [p1, p2] = topStack(stack),
                        res = p2 / p1 | 0 //floored
                    stack.push(res);
                },
                eqz({
                    stack
                }) {
                    let p1 = stack.pop();
                    stack.push(p1 == 0);
                },
                const ({
                    stack,
                    datac
                }, [num]) {
                    //yay
                    stack.push(num in datac ? datac[num] : +num);
                },
                select({
                    stack
                }) {
                    let a = 2,
                        bool = stack.pop(),
                        top = stack.slice(-a);
                    stack.splice(-a, a);
                    stack.push(top[+bool]);
                },
                max({
                    stack
                }) {
                    let [p1, p2] = topStack(stack);
                    stack.push(Math.max(p2, p1));
                },
                min({
                    stack
                }) {
                    let [p1, p2] = topStack(stack);
                    stack.push(Math.min(p2, p1));
                },
                rotl({
                    stack
                }) {
                    let [p1, p2] = topStack(stack),
                        res = rotatel(p2, p1);
                    stack.push(res);
                },
                rotr({
                    stack
                }) {
                    let [p1, p2] = topStack(stack),
                        res = rotater(p2, p1);
                    stack.push(res);
                }
            },
            symfuncs: { //symbol funcs for function arguments
                func({
                    stack
                }, [str]) {
                    stack.push(['func', str]);
                },
                result({
                    stack
                }, [type]) {
                    stack.push(['ret', type]);
                },
                param({
                    stack
                }, [varname, type]) {
                    let pindex = (varname.match(/\d+/g) || [])[0];
                    stack.push(['par', pindex, type]);
                },
                local({_local},[varname]){
                    _local[varname] = null;
                },
                export ({
                    _local,
                    _exports
                }, [str]) {
                    //moves local func to export obj
                    _exports[str] = _local[str];
                },
                type({acall},[type],fname){
                    if (type == "$t0") {
                        acall.push(fname);
                    }
                },
                start(){}
            }
        };
        var {
            funcSymbls,
            symbols,
            symarg,
            symfuncs
        } = _robj;
        this.funcSymbls = funcSymbls;
        this.funcargs = funcargs;
        this.fSymbols = fSymbols;
        this.symbols = symbols;
        this.symarg = symarg;
        this.symfuncs = symfuncs;
        this.sSymbols = ["if", "else", "end"];
    }

    //relaces LF and CRLF lines with a space
    //and get rid of all double spaces
    clean(str) {
        return str.replace(/\r\n|\n/g, ' ').replace(/\s+/g, ' ');
    }

    parseBrackets(str) {
        if (!str.includes `(`) return null;
        let part = str,
            running = true,
            o = 0,
            c = 0,
            [os, cs] = '()'.split ``;
        //use split instead of iterator for babel compatability
        part.split('').forEach((char, index) => {
            if (!running) return; // stop if not running
            //stop when opening parenthcies match closing parenthencies
            char == os ? o++ : 0;
            char == cs ? c++ : 0
            if (o > 0 && c > 0 && o == c) running = !(str = str.slice(str.indexOf(os) + 1, index), part = part.slice(index + 1));
        });

        return [str, part]
    }

    //needs fixing
    getParams(str) {
        let args = [...new Set(str.match(/\([A-Za-z0-9 _"$]+\)/g) || [])],
            top = [...args].pop(),
            after = str.slice(str.indexOf(top) + top.length);
        return [args, after]
    }

    //find assist
    findPar(str, search) {
        let ffunc = str.slice(str.indexOf(search)),
            rargs = this.parseBrackets(ffunc);
        if (rargs == null) return null;
        let stext = this.clean(rargs[0]);

        return [stext, rargs[1]];
    }
    
    //this makes my code less gay
    findAllPar(str, search) {
        let arr = [];
        while (true) {
            let rarr = this.findPar(str, search);
            if (rarr == null) break;
            str = rarr[1];
            arr.push(rarr[0]); //push index 0
        }
        return arr;
    }

    //funcs
    getFuncs(str) {
        return this.findAllPar(str, '(func $');
    }

    //globals
    getGlobals(str) {
        return this.findAllPar(str, '(global $');
    }

    //data
    getDatas(str) {
        return this.findAllPar(str, '(data ');
    }
    
    //imports
    getImports(str) {
        return this.findAllPar(str, '(import "');
    }

    //token parsing
    parseTokens(tokens, fname) {
        tokens.forEach(token => {
            let iArr = this.symbols.map(e => [token.includes(e), e]), //maps symbols
                sparse = iArr.some(e => e[0] == true), //checks if the text includes any symbols
                iSymbols = iArr.filter(e => e[0]).map(e => e[1]); //array of just symbol text

            if (!sparse && !(iSymbols.pop() in this.symarg)) return; //if no symbol or no args return

            //get args
            let sym = iSymbols.pop(),
                reg = this.symarg[sym] || new RegExp(),
                args = [...(token.match(reg) || []).slice(1)];

            //do stuff if no args
            if (args.length < 1) return; //return if no args

            this.symfuncs[sym](this._module, args, fname); //call symbol
        })
    }

    //added support for float
    getTypes(stack) {
        let running = true,
            fargs = [],
            ret = void 0;
        stack.forEach(([pre, ...args]) => {
            if (!running) return;
            switch (pre) {
                case "par":
                    fargs[args[0]] = (args[1][0] == "i" || args[1][0] == "f") ? "number" : "?";
                    break;
                case "ret":
                    ret = (args[0][0] == "i" || args[0][0] == "f") ? "number" : "?"
                    running = false;
                    break;
            }
        })
        let rarr = [fargs, ret];
        //used iterator so conversion works
        stack.splice(0, ([...fargs, ret]).length) //remove parsed elements from stack

        return rarr;
    }

    //I did the work :)
    itokenize(str) {
        let arr = this.clean(str).replace(/\s/, '').split ` `,
            rarr = [],
            syms = '"[]'.split(''),
            iobj = {
                ilit: false,
                cstr: ''
            }

        //don't tokenize strings because they are literal
        arr.forEach(token=>{
            //if literal begin literall
            if (syms.includes(token[0])) iobj.ilit = true;

            if (iobj.ilit) 
                iobj.cstr += " " + token;
            else
                rarr.push(token);

            if (syms.includes(token[token.length-1])) {
                rarr.push(iobj.cstr);
                iobj.ilit = false;
                iobj.cstr = '';
            }
        });

        return rarr.filter(e=>e!='');
    }

    //depricated
    //loop through tokens are put together symbols with their args
    //after that just do a similar parse as func params
    itokenParser(tokens) {
        tokens.push('');
        let rtokens = [],
            argd = {
                iarg: false,
                maxc: null,
                cstr: '',
                carg: 0
            },
            update = () => {
                rtokens.push(argd.cstr);
                argd.cstr = '';
                argd.maxc = null;
                argd.carg = 0;
                argd.iarg = false;
            };
        tokens.forEach(token => {
            let iArr = this.fSymbols.map(e => [token.includes(e), e]),
                iSymbols = iArr.filter(e => e[0]).map(e => e[1]),
                sym = iSymbols.pop(),
                ispc = this.sSymbols.includes(token);

            //if end of args remove is arg flag
            if (argd.carg >= argd.maxc) update();

            if (argd.iarg) return (argd.cstr += " " + token, argd.carg++); //concat token with args

            if (!sym && !argd.iarg && !ispc) return; //throw new Error(`Unexpected token "${token}"`)

            //set
            if (ispc) {
                argd.cstr += token;
                argd.iarg = true;
                argd.maxc = 0;
            } else {
                let count = this.funcargs[argd.cstr += sym].count;
                argd.iarg = true;
                argd.maxc = count;
            }
            

            if (argd.maxc == 0) update();

        });

        return rtokens.filter(e=>e!='');
    }

    //memory functions
    arrToMem(arr) {
        let sTypes = ['string'], //supported types for arr to mem convertion
            arrTypes = arr.map(this.getType),
            // checks if arr includes only from sTypes array
            isType = arrTypes.every(e => sTypes.map(t => e.includes(t)).some(f => f));

        if (!isType) throw new Error("Unsupported type");

        //return arr to be converted to UintArray when returned
        let rarr = Array.from(
            arr,
            e => [sTypes.indexOf(this.getType(e)) + 1, ...new TextEncoder().encode(e), 0, this.typeMap.arrd]
        ).flatn();

        rarr.pop();
        rarr.push(this.typeMap.arre);
        rarr = [this.typeMap.arr, ...rarr];

        return rarr;
    }

    //note, possible type expantion
    //maybe for global ints
    memToArr(arr) {
        let rarr = [],
            adata = {
                iarr: false,
                istr: false,
                tstr: [],
                pstr: ''
            }
        arr.forEach(el => {
            if (el == this.typeMap.arr) return adata.iarr = true;
            if (!adata.iarr) return;
            //note should use switch statement for type expanstion
            if (el == this.typeMap.string) return adata.istr = true;

            if (adata.istr && el == 0) {
                let dec = new TextDecoder();
                adata.pstr = dec.decode(new Uint8Array(adata.tstr));
            }

            if (adata.istr && (el == this.typeMap.arrd || el == this.typeMap.arre)) {
                rarr.push(adata.pstr);
                adata.tstr = [];
                adata.pstr = '';
                adata.istr = false;
            }

            if (el == this.typeMap.arre) adata.iarr = false;

            if (adata.istr && el != 0) adata.tstr.push(el);
        })

        return rarr
    }

    //not used yet
    memStr(str) {
        return str.replace(/\\00/g, '');
    }

    runFromLocation(location, arrlen) {
        let ploc = +location, //parseint the function name which is the location of the instructions in memeory
            memArr = this._module.memory.slice(ploc, ploc + arrlen),
            arr = this.memToArr(memArr);

        return this.runIntructions(arr, '_' + location);
    }
    //--end

    //add loops
    runIntructions(tokens, fname = null) {
        let pdata = {
            isif: false,
            ise: false,
            ifarr: [],
            elsearr: []
        }
        tokens.forEach(token => {
            let iArr = this.fSymbols.map(e => [token.includes(e), e]), //maps symbols
                sparse = iArr.some(e => e[0] == true), //checks if the text includes any symbols
                iSymbols = iArr.filter(e => e[0]).map(e => e[1]); //array of just symbol text

            
            switch (token) {
                case this.sSymbols[0]: pdata.isif = true; break;
                case this.sSymbols[1]: pdata.ise = true; break;
                case this.sSymbols[2]: 
                    pdata.isif = false;
                    pdata.ise = false;
                    let top = this._module.stack.pop(),
                        res = this.runIntructions.call(this, top ? pdata.ifarr : pdata.elsearr, fname);
                    this._module.stack.push(res);
                    break;
            }
            
            if (pdata.isif && !this.sSymbols.includes(token)) {
                (pdata.ise ? pdata.elsearr : pdata.ifarr ).push(token);
            } else {
                if (!sparse && !(iSymbols.pop() in this.funcSymbls)) return; //if no symbol or missing func return
    
                //get args
                let sym = iSymbols.pop(),
                    symobj = this.funcargs[sym],
                    reg = symobj.reg || new RegExp(),
                    args = [...(token.match(reg) || []).slice(1)],
                    cargs = [this._module, args, fname];
    
                this.funcSymbls[sym].apply(this, cargs); //call symbol
            }
        })

        return this._module.stack.pop();
    }

    pArgs(args, fname) {
        this._module._local[fname] = [...args];
    }

    Module(focus, settings) {
        //if settings set entry point set the entry point xd
        if (typeof (settings) == 'object') {
            if ('entry_point' in settings) this.entry_point = settings.entry_point;
        }

        //imports
        const imports = this.getImports(focus);

        imports.forEach(imprt => {
            let loc = imprt.match(/"[0-9A-Za-z]+"/g)
            loc = loc.map(e=>e.slice(1,-1));

            if ('imports' in settings) {
                let nloc = loc.slice(1),
                    idir = settings.imports;
                nloc.forEach(e=>{
                    let ret = idir[e];
                    if (!ret) throw new Error(e + ": Is undefined")
                    idir = ret;
                });


                let cdir = this._module._local;
                loc.forEach(e=>{
                    let ret = cdir[e];
                    if (ret != undefined) cdir=ret;
                });

                //set value
                cdir[loc.pop()] = idir;
            }
        })

        //data parse before for globals
        const datas = this.getDatas(focus);

        datas.forEach(data=>{
            //actually big brain
            let bi = data.indexOf('('),
                [dparams, after] = this.parseBrackets(data.slice(bi)),
                [,str] = after.match(/"([\\0-9]+)"/),
                val = this.runIntructions([dparams]);
            //note 15*3 is bytes that describe attribute
            this._module.datac[(val+16)+[]] = this.memStr(str.slice(15*3));
        })

        //need to parse data params to convert certain global ints to strings and arrays.
        //globals
        const globals = this.getGlobals(focus); //parse global vars before functions running

        globals.forEach(globl => {
            let [,gname] = globl.match(/global\s\$([0-9A-Za-z.]+)\s/) || [];
            if (!gname) return;
            let [gparams, val] = this.getParams(globl),
                ret = this.runIntructions([val]);

            this._module._local[gname] = ret;

            //parse paramaters last
            this.parseTokens(gparams);
        })

        //get all functions
        const funcs = this.getFuncs(focus);

        funcs.forEach(func => {
            let [,fname] = func.match(/func\s\$([0-9A-Za-z.]+)\s/) || [];
            if (!fname) return;
            let [fparams, instructions] = this.getParams(func);
                
            
            //skip functions that do nothing and self exec
            if (/\(type\s\$t0\)/.test(fparams) && instructions == '') return;
            
            //push func name to stack
            this.symfuncs.func(this._module, [fname]);

            //parse func params
            this.parseTokens(fparams, fname);

            //create function
            let [pre, nfname] = this._module.stack[0];
            if (pre != 'func') return;
            this._module._local[nfname] = null;
            this._module.stack.splice(0, 1); //remove top element on stack

            //parse actual function instructions
            let iTokens = this.itokenize(instructions),
                pTokens = this.itokenParser(iTokens),
                memTokens = this.arrToMem(pTokens);

            //write instructions to memory
            this._module.memory.splice(this._module.lastl, memTokens.length, ...memTokens);

            //generate function
            let hlastl = this._module.lastl.toString(16),
                types = this.getTypes(this._module.stack),
                nfunc = function (scope) {
                    return (function (...args) {
                        let ctypes = types[0],
                            getType = a => a.constructor.name.toLowerCase(),
                            cmpArr = (...arrs) => {
                                var str = arrs.map(e => e + []);
                                return str.every(e => e == str[0]);
                            };
                        let isArg = cmpArr([ctypes, args].map(e => e.map(getType)));
                        if (!isArg) throw new Error("Invalid argument type");
                        let loc = "_0x" + hlastl;
                        scope.pArgs(args, loc);
                        return scope.runFromLocation(loc.slice(1), memTokens.length);
                    })
                }(this);

            //scope assingment
            if (fname in this._module._local) this._module._local[fname] = nfunc;
            if (fname in this._module._exports) this._module._exports[fname] = nfunc;

            this._module.lastl = memTokens.length + 1;
        })

        if (this.entry_point && this.entry_point in this._module._exports) this._module._exports[entry_point]();

        //self exec funcs
        this._module.acall.forEach(e=>this._module._local[e]());

        return this._module._exports;
    }
}

module.exports = watInterpreter;
