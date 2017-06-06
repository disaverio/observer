/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2017 Andrea Di Saverio
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

    function _retrieveParams(confParams, returnedFromObserved) {

        var params = [];

        confParams = confParams || [];
        confParams.forEach(function(confParam) {
            confParam.constructor === Function        ? params.push(confParam())          :
            confParam == global.OBS_OBSERVED_RETURNED ? params.push(returnedFromObserved) :
                                                        params.push(confParam)
        });

        return params;
    }

    function _checkConditions(conditionsTree, returnedFromObserved) {

        // if no condition is specified the observer function will be fired
        if (!conditionsTree) return true;

        if (conditionsTree.type == 1) {
            return checkSingleCondition(conditionsTree);
        } else {
            if (conditionsTree.operator == 'AND') {
                for (var i = 0; i < conditionsTree.sons.length; i++) {
                    var checkResult = _checkConditions(conditionsTree.sons[i], returnedFromObserved);
                    if (!checkResult) return false;
                }
                return true;
            } else if (conditionsTree.operator == 'OR') {
                for (var i = 0; i < conditionsTree.sons.length; i++) {
                    var checkResult = _checkConditions(conditionsTree.sons[i], returnedFromObserved);
                    if (checkResult) return true;
                }
                return false;
            } else if (conditionsTree.operator == 'NOT') {
                return (!_checkConditions(conditionsTree.sons[0], returnedFromObserved));
            }
        }


        function checkSingleCondition(condition) {

            var firstParam = null;
            condition.firstParam == global.OBS_OBSERVED_RETURNED ? firstParam = returnedFromObserved   :
            condition.firstParam.constructor === Function        ? firstParam = condition.firstParam() :
            condition.firstType == OBS_PRIMITIVE                 ? firstParam = condition.firstParam   :
                                                                   firstParam = getValue(condition.firstScope, condition.firstParam.split('.'));


            if (condition.secondParam || condition.secondType) {
                var secondParam = null;
                condition.secondParam == global.OBS_OBSERVED_RETURNED ? secondParam = returnedFromObserved    :
                condition.secondParam.constructor === Function        ? secondParam = condition.secondParam() :
                condition.secondType == OBS_PRIMITIVE                 ? secondParam = condition.secondParam   :
                                                                        secondParam = getValue(condition.secondScope, condition.secondParam.split('.'));
            } else {
                return (firstParam ? true : false);
            }

            switch (condition.operator) {
                case '===': return firstParam === secondParam;
                case '!==': return firstParam !== secondParam;
                case '==' : return firstParam == secondParam;
                case '!=' : return firstParam != secondParam;
                case '<'  : return firstParam < secondParam;
                case '<=' : return firstParam <= secondParam;
                case '>'  : return firstParam > secondParam;
                case '>=' : return firstParam >= secondParam;
                default   : return false;
            }

            function getValue(obj, path) {
                return path.length > 1 ? getValue(obj[path[0]], path.slice(1)) : obj[path[0]];
            }
        }
    }

    function _createConditionsTree(confConditions) {

        if (!confConditions) return undefined;

        return Array.isArray(confConditions) ? manageArray(confConditions) : createLeaf(confConditions);

        function manageArray(arrayConditions) {

            if (arrayConditions[0] != 'OR' && arrayConditions[0] != 'AND' && arrayConditions[0] != 'NOT') throw new Error("Observer | Unknown operator: '"+ arrayConditions[0] +"'");

            if (arrayConditions[0] == 'NOT' && arrayConditions.length != 2) throw new Error("Observer | 'NOT' operator must have only one argument.");

            if ((arrayConditions[0] == 'OR' || arrayConditions[0] == 'AND') && arrayConditions.length <= 2) throw new Error("Observer | '" + arrayConditions[0] + "' operator must have at least two arguments.");

            var node = {
                type:     0, // operator
                operator: arrayConditions[0],
                sons:     []
            };

            arrayConditions.slice(1).forEach(function(condition) {
                Array.isArray(condition) ? node.sons.push(manageArray(condition)) : node.sons.push(createLeaf(condition));
            });

            return node;
        }

        function createLeaf(objCondition) {

            if (objCondition.constructor === Function) objCondition = { firstParam: objCondition };

            if (!objCondition || !objCondition.firstParam) throw new Error("Observer | Invalid condition: "+ objCondition.operator);

            if (objCondition.operator && objCondition.operator != "===" && objCondition.operator != "!==" && objCondition.operator != "==" && objCondition.operator != "!=" && objCondition.operator != ">" && objCondition.operator != ">=" && objCondition.operator != "<" && objCondition.operator != "<=") throw new Error("Observer | Unknown operator: '"+ objCondition.operator +"'");

            return {
                type:        1, // condition
                firstParam:  objCondition.firstParam,
                firstType:   objCondition.firstType,
                firstScope:  objCondition.firstScope || global,
                operator:    objCondition.operator || "==",
                secondParam: objCondition.secondParam,
                secondType:  objCondition.secondType,
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
            if (this.subscribers[i].fn == f) this.subscribers.splice(i,1);
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
                        args.push(lastArg);
                    } else {
                        subscriber.fn[stateAttribute] = lastArg.state;
                    }
                    
                    args.length > 0 ? subscriber.fn.apply(subscriber.fn.context, args) : subscriber.fn.apply(subscriber.fn.context);
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