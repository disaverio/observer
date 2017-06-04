# observer.js
`observer.js` is a tiny Javascript library to adopt observer pattern in a project with minimal impact on existing codebase.
It allows transparent interaction between modules without the need to modify modules itself.

It tracks an execution state of observers to avoid infinite loop on cyclic configurations.

## How to use

All you have to do is import the lib in the project:
 ```js
<script src='observer.min.js'></script>
```
and declare a function as observable:
```js
var myObservedFun = (function() {}).observable();
```
or overwrite an existing reference to a function with observable version:
 ```js
myObj.myObservedFun = myObj.myObservedFun.observable();
 ```
Now you can set observers, also with a chaining notation:
```js
var firstObserver = function() { console.log('fistObserver execution!') };
var secondObserver = function() { console.log('secondObserver execution!') };

myObservedFun.addObserver(firstObserver)
             .addObserver(secondObserver);
```

Observers removal is supported. One by one:
```js
myObservedFun.removeObserver(firstObserver);
```
or all in one shot:
```js
myObservedFun.removeAllObservers();
```

That's all!

`observer.js` supports more complex situations: for an advance use check next sections.

## Options

`observer.js` supports complex configurations with conditional executions and parameters retrieval for observers. 


### Observer execution context
To bind observer execution to a context you can clearly pass the binded version, like `.addObserver(myfun.bind(context))`.

Otherwise you can set the execution context by a property, passing an object `addObserver()` with `fn` and `context`.
```js
myObservedFun.addObserver({
    fn: myObserver,
    context: myObj
})
```
The first method is discouraged, especially if same function is used more than one time as observer because it may lead to a fail in state-checking.
This because `func != func.bind(context)` and, more important `func.bind(context) != func.bind(context)`.

In a cyclic configuration of observers it leads to an infinite loop.

### Conditional execution
Observers execution can be conditionated to conditions provided during observer binding.

To define conditions you have to pass an object to `addObserver()`, with observer function and conditions definition:
```js
myObservedFun.addObserver({
    fn: firstObserver,
    conditions: {}
})
```
`conditions` can be set with an object (*single condition*) or an array (*multiple conditions*).

##### Single condition:
A single condition is an object with at least one parameter `firstParam` to be checked before execution:
```js
{ firstParam: 'nested.object.paramName' }
```
In general you can define a condition as a comparison of two parameters:
you have to set two parameters (`firstParam`, `secondParam`) and a comparison operator (`operator`).

As parameter you can set:
- value returned from observed: you have to set parameter to `OBS_OBSERVED_RETURNED`
- primitive value: you **have to** specify type attribute (`firstType` for `firstParam` or `secondType` for `secondParam`) as `OBS_PRIMITIVE`
- "*stringed*" reference of a variable (*dot-notation* is supported)
- reference to a function

As operator you can set: `"==="`, `"!=="`, `"=="`, `"!="`, `"<"`, `"<="`, `">"`, `">="`

A condition with only one parameter (`firstParam`) set will be checked by `if (firstParam)`.

Example with value of variable `my.nestedObj.myVar` compared with value returned from `anotherObj.myFun` function:
```js
{
    firstParam: 'my.nestedObj.myVar',
    operator: '<=',
    secondParam: anotherObj.myFun
}
```

Example with value returned from observed function compared with `null` (primitive value):
```js
{
    firstParam: OBS_OBSERVED_RETURNED,
    operator: '===',
    secondParam: null,
    secondType: OBS_PRIMITIVE
}
```

##### Multiple conditions:
Boolean expressions to compare multiple single conditions is supported.

To use boolean operators you have to set `conditions` as array, where first element **is** one of `"AND"`, `"OR"`, `"NOT"`.
Subsequent elements can be single conditions or array itself (recursive).

Example condition: `(A && B && (C || !D || E))` will be:

`["AND", A, B, ["OR", C, ["NOT", D], E]]`

where `A`, ..., `E` are single condition objects defined like above.