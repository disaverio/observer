/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2016 Andrea Di Saverio
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

"use strict";
(function(global, undefined) {

    var ID = Math.random().toString(36).slice(2);

    global.RETURNED_FROM_OBSERVED = Math.random();
    global.PRIMITIVE = Math.random();

    function _isArray(object) {
        if (Array.isArray)
            return Array.isArray(object);

        return typeof object !== 'undefined' && object && object.constructor === Array;
    }

    function _retrieveParams(confParams, returnedFromObserved) {

        if (!confParams) {
            return undefined;
        }

        var params = [];

        for (var i = 0; i < confParams.length; i++) {
            if (confParams[i].constructor === Function) {
                params.push(confParams[i]());
            } else if (confParams[i] == global.RETURNED_FROM_OBSERVED) {
                params.push(returnedFromObserved);
            } else {
                params.push(confParams[i]);
            }
        }

        return params;
    }

    function _checkConditions(conditionsTree, returnedFromObserved) {

        if (!conditionsTree) { // if no condition is specified the observer function will be fired
            return true;
        }

        if (conditionsTree.type == "CONDITION") {
            return checkSingleCondition(conditionsTree);
        } else {
            if (conditionsTree.operator == "AND") {
                for (var i = 0; i < conditionsTree.sons.length; i++) {
                    var checkResult = _checkConditions(conditionsTree.sons[i]);
                    if (!checkResult)
                        return false;
                }
                return true;
            } else if (conditionsTree.operator == "OR") {
                for (var i = 0; i < conditionsTree.sons.length; i++) {
                    var checkResult = _checkConditions(conditionsTree.sons[i]);
                    if (checkResult)
                        return true;
                }
                return false;
            } else if (conditionsTree.operator == "NOT") {
                return (!_checkConditions(conditionsTree.sons[0]));
            }
        }


        function checkSingleCondition(condition) {

            if (condition.firstParam == global.RETURNED_FROM_OBSERVED) {
                var firstParam = returnedFromObserved;
            } else if (condition.firstParam.constructor === Function) {
                var firstParam = condition.firstParam();
            } else if (condition.firstType == PRIMITIVE) {
                var firstParam = condition.firstParam;
            } else {
                var firstParam = getValue(global, condition.firstParam.split('.'));
            }

            if (condition.secondParam != undefined) {
                if (condition.secondParam == global.RETURNED_FROM_OBSERVED) {
                    var secondParam = returnedFromObserved;
                } else if (condition.secondParam.constructor === Function) {
                    var secondParam = condition.secondParam();
                } else if (condition.secondType == PRIMITIVE) {
                    var secondParam = condition.secondParam;
                } else {
                    var secondParam = getValue(global, condition.secondParam.split('.'));
                }
            } else {
                return (firstParam ? true : false);
            }

            switch (condition.operator) {
                case "===":
                    return firstParam === secondParam;
                case "!==":
                    return firstParam !== secondParam;
                case "==":
                    return firstParam == secondParam;
                case "!=":
                    return firstParam != secondParam;
                case "<":
                    return firstParam < secondParam;
                case "<=":
                    return firstParam <= secondParam;
                case ">":
                    return firstParam > secondParam;
                case ">=":
                    return firstParam >= secondParam;
                default:
                    return false;
            }

            function getValue(obj, path) {
                if (path.length > 1)
                    return getValue(obj[path[0]], path.slice(1));
                else
                    return obj[path[0]];
            }
        }
    }

    function _createConditionsTree(confConditions) {

        if (!confConditions) {
            return undefined;
        }
        if (_isArray(confConditions)) {
            return manageArray(confConditions);
        } else {
            return createLeaf(confConditions);
        }

        function manageArray(arrayConditions) {

            if (arrayConditions[0] != "OR" && arrayConditions[0] != "AND" && arrayConditions[0] != "NOT") {
                throw new Error("Observer | Unknown operator: '"+ arrayConditions[0] +"'");
            }
            if (arrayConditions[0] == "NOT" && arrayConditions.length != 2) {
                throw new Error("Observer | 'NOT' operator must have only one argument.");
            }
            if ((arrayConditions[0] == "OR" || arrayConditions[0] == "AND") && arrayConditions.length <= 2) {
                throw new Error("Observer | '" + arrayConditions[0] + "' operator must have at least two arguments.");
            }

            var node = {
                type: "OPERATOR",
                operator: arrayConditions[0],
                sons: []
            };

            arrayConditions.slice(1).forEach(function(condition) {
                if (_isArray(condition)) {
                    node.sons.push(manageArray(condition));
                } else {
                    node.sons.push(createLeaf(condition));
                }
            });

            return node;
        }

        function createLeaf(objCondition) {

            if (!objCondition || !objCondition.firstParam) {
                throw new Error("Observer | Invalid condition: "+ objCondition.operator);
            }
            if (objCondition.operator && objCondition.operator != "===" && objCondition.operator != "!==" && objCondition.operator != "==" && objCondition.operator != "!=" && objCondition.operator != ">" && objCondition.operator != ">=" && objCondition.operator != "<" && objCondition.operator != "<=") {
                throw new Error("Observer | Unknown operator: '"+ objCondition.operator +"'");
            }

            return {
                type: "CONDITION",
                firstParam: objCondition.firstParam,
                firstType: objCondition.firstType || global,
                operator: objCondition.operator || "==",
                secondParam: objCondition.secondParam,
                secondType: objCondition.secondType || global
            };
        }
    }

    function addObserver(observer) {

        if (observer instanceof Function) {
            observer = {
                fn: observer
            }
        }

        this.subscribers.push({
            fn: observer.fn,
            conditions: _createConditionsTree(observer.conditions),
            params: observer.params
        });

        return this;
    }

    function removeObserver(f) {

        for (var i = this.subscribers.length-1; i>=0;  i--) {
            if (this.subscribers[i].fn == f) {
                this.subscribers.splice(i,1);
            }
        }

        return this;
    }

    function removeAllObservers() {

        this.subscribers = [];

        return this;
    }

    Function.prototype.observable = function() {

        var fn = this;

        var f = function() {

            var args = Array.prototype.slice.call(arguments);
            var lastArg = args.slice(-1)[0];

            if (lastArg && lastArg.ID == ID) {
                if (f.state == ID + lastArg.state) {
                    return;
                } else {
                    args.splice(-1, 1);
                }
            }
            if (!lastArg) {
                lastArg = {
                    ID: ID,
                    state: Math.random().toString(36).slice(2)
                }
            }

            f.state = ID + lastArg.state;

            var returnedFromObserved = fn.apply(this, args);

            f.subscribers.forEach(function(subscriber) {

                if (subscriber.fn.state == f.state) {
                    return;
                }

                if (_checkConditions(subscriber.conditions, returnedFromObserved)) {

                    var args = _retrieveParams(subscriber.params, returnedFromObserved);
                    if (subscriber.fn.subscribers && subscriber.fn.addObserver && subscriber.fn.removeObserver && subscriber.fn.removeAllObservers) { // duck typing check
                        args = args || [];
                        args.push(lastArg);
                    } else {
                        subscriber.fn.state = ID + lastArg.state;
                    }
                    
                    subscriber.fn.apply(null, args);
                }
            });

            return returnedFromObserved;
        };

        f.subscribers = [];

        f.addObserver = addObserver.bind(f);
        f.removeObserver = removeObserver.bind(f);
        f.removeAllObservers = removeAllObservers.bind(f);

        return f;
    };

})(this);