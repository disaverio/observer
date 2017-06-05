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

    global.OBS_OBSERVED_RETURNED = Math.random();
    global.OBS_PRIMITIVE = Math.random();

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
            } else if (confParams[i] == global.OBS_OBSERVED_RETURNED) {
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
                    var checkResult = _checkConditions(conditionsTree.sons[i], returnedFromObserved);
                    if (!checkResult)
                        return false;
                }
                return true;
            } else if (conditionsTree.operator == "OR") {
                for (var i = 0; i < conditionsTree.sons.length; i++) {
                    var checkResult = _checkConditions(conditionsTree.sons[i], returnedFromObserved);
                    if (checkResult)
                        return true;
                }
                return false;
            } else if (conditionsTree.operator == "NOT") {
                return (!_checkConditions(conditionsTree.sons[0], returnedFromObserved));
            }
        }


        function checkSingleCondition(condition) {

            if (condition.firstParam == global.OBS_OBSERVED_RETURNED) {
                var firstParam = returnedFromObserved;
            } else if (condition.firstParam.constructor === Function) {
                var firstParam = condition.firstParam();
            } else if (condition.firstType == OBS_PRIMITIVE) {
                var firstParam = condition.firstParam;
            } else {
                var firstParam = getValue(condition.firstScope, condition.firstParam.split('.'));
            }

            if (condition.secondParam || condition.secondType) {
                if (condition.secondParam == global.OBS_OBSERVED_RETURNED) {
                    var secondParam = returnedFromObserved;
                } else if (condition.secondParam.constructor === Function) {
                    var secondParam = condition.secondParam();
                } else if (condition.secondType == OBS_PRIMITIVE) {
                    var secondParam = condition.secondParam;
                } else {
                    var secondParam = getValue(condition.secondScope, condition.secondParam.split('.'));
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
                if (path.length > 1) {
                    return getValue(obj[path[0]], path.slice(1));
                } else {
                    if (obj[path[0]] === Function) {
                        return obj[path[0]]();
                    } else {
                        return obj[path[0]];
                    }
                }
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

            if (objCondition.constructor === Function) {
                objCondition = { firstParam: objCondition }
            }

            if (!objCondition || !objCondition.firstParam) {
                throw new Error("Observer | Invalid condition: "+ objCondition.operator);
            }
            if (objCondition.operator && objCondition.operator != "===" && objCondition.operator != "!==" && objCondition.operator != "==" && objCondition.operator != "!=" && objCondition.operator != ">" && objCondition.operator != ">=" && objCondition.operator != "<" && objCondition.operator != "<=") {
                throw new Error("Observer | Unknown operator: '"+ objCondition.operator +"'");
            }

            return {
                type: "CONDITION",
                firstParam: objCondition.firstParam,
                firstType: objCondition.firstType,
                firstScope: objCondition.firstScope || global,
                operator: objCondition.operator || "==",
                secondParam: objCondition.secondParam,
                secondType: objCondition.secondType,
                secondScope: objCondition.secondScope || global,
            };
        }
    }

    function addObserver(observer) {

        this.subscribers.push({
            fn:         observer.constructor === Function ? observer  : observer.fn,
            conditions: observer.constructor === Function ? undefined : _createConditionsTree(observer.conditions),
            params:     observer.constructor === Function ? undefined : observer.params,
            context:    observer.constructor === Function ? undefined : observer.context
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

            var stateAttribute = 'state_' + ID;

            var args = Array.prototype.slice.call(arguments);
            var lastArg = args.slice(-1)[0];

            if (lastArg && lastArg.ID == ID) {

                if (f[stateAttribute] == lastArg.state) {
                    return;
                }
                args.splice(-1, 1);

            } else {
                lastArg = {
                    ID: ID,
                    state: Math.random().toString(36).slice(2)
                }
            }

            f[stateAttribute] = lastArg.state;

            var observedVal = fn.apply(this, args);

            f.subscribers.forEach(function(subscriber) {

                if (subscriber.fn[stateAttribute] == f[stateAttribute]) {
                    return;
                }

                if (_checkConditions(subscriber.conditions, observedVal)) {

                    var args = _retrieveParams(subscriber.params, observedVal);
                    if (subscriber.fn.subscribers && subscriber.fn.addObserver && subscriber.fn.removeObserver && subscriber.fn.removeAllObservers) { // duck typing check
                        args = args || [];
                        args.push(lastArg);
                    } else {
                        subscriber.fn[stateAttribute] = lastArg.state;
                    }
                    
                    subscriber.fn.apply(subscriber.fn.context, args);
                }
            });

            return observedVal;
        };

        f.subscribers = [];

        f.addObserver = addObserver.bind(f);
        f.removeObserver = removeObserver.bind(f);
        f.removeAllObservers = removeAllObservers.bind(f);

        return f;
    };

})(this);