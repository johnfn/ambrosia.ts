interface EventCB { (...attrs: any[]): any };

var fileCache: { [key: string]: string } = {};

function prop(target: Object, name: string) {
  Object.defineProperty(target, name, {
    get: function() { return this["_" + name]; },
    set: function(value) { this["_" + name] = value; },
    enumerable: true,
    configurable: true
  });
}

function validatedProp(validate: (x: any) => boolean) {
  return function _prop(target: Object, name: string) {
    Object.defineProperty(target, name, {
      get: function() { return this["_" + name]; },
      set: function(value) {
        if (validate(value)) {
          this["_" + name] = value;
        } else {
          console.error(`Invalid value ${value}.`);
        }
      },
      enumerable: true,
      configurable: true
    });
  }
}

/**
  Calls `callback` on each object in `list`, returning a new list of every object for which
  the callback returned true.
*/
function filter<T>(list: T[], callback: (t: T) => boolean): T[] {
  var result: T[] = [];
  var len = list.length;

  for (var i = 0; i < len; i++) {
    if (callback(list[i])) {
      result.push(list[i]);
    }
  }

  return result;
}

function isFunction(obj: any) {
  return typeof obj == 'function' || false;
}

/**
  Maybe type in the spirit of Haskell to indicate nullable types. It doesn't have all the Monadic coolness of Haskell,
  but it indicates nullable types pretty well.
*/
class Maybe<T> {
  public hasValue: boolean = false;
  private _value: T;

  constructor(value: T = undefined) {
    this.value = value;
  }

  get value(): T {
    if (this.hasValue) {
      return this._value;
    }

    console.error("asked for value of Maybe without a value");
  }

  set value(value: T) {
    this._value = value;

    this.hasValue = value !== undefined;
  }
}

/**
  Simple wrapper for objects that adds some event listening capabilities. Any getter/setter
  pairs defined on an inheriting object will automatically trigger events on that object when used.
*/
class Ambrosia {
  static overridden: { [key: string]: boolean } = {};
  listeners: { [key: string]: EventCB[] } = {};
  _props: string[] = undefined;

  constructor() {
    var proto: any = Object.getPrototypeOf(this);
    while (proto.constructor !== Ambrosia && !Ambrosia.overridden[Ambrosia.fullyQualifiedName(proto)]) {
      this.overrideProperties(proto);

      proto = Object.getPrototypeOf(proto)
    }

    this.bindEverything();
  }

  // Given Foo which prototypically inherits from Bar, this returns Bar#Foo.
  private static fullyQualifiedName(proto: any): string {
    var names: string[] = [];

    while (proto.constructor !== Ambrosia) {
      names.push(proto.constructor.name);

      proto = Object.getPrototypeOf(proto);
    }

    return names.join("#");
  }

  private hasGetterAndSetter(proto: any, name: string): boolean {
    var pd: PropertyDescriptor = Object.getOwnPropertyDescriptor(proto, name);

    return pd != undefined && pd.get != undefined;
  }

  public props(): string[] {
    if (this._props === undefined) {
      var proto: any = Object.getPrototypeOf(this);
      this._props = [];

      while (proto.constructor !== Ambrosia) {
        var networkProps: string[] = filter(Object.getOwnPropertyNames(proto),
          (name: string) => this.hasGetterAndSetter(proto, name));

        this._props = this._props.concat(networkProps);

        proto = Object.getPrototypeOf(proto);
      }
    }

    return this._props;
  }

  overrideProperties(proto: any): void {
    Ambrosia.overridden[Ambrosia.fullyQualifiedName(proto)] = true;

    // TODO: Object.getOwnPropertyNames()
    for (var accessorName in this) {
      var pd: PropertyDescriptor = Object.getOwnPropertyDescriptor(proto, accessorName);

      // Is this a getter + setter?
      if (pd && pd.get) {
        this.overrideSetterGetter(pd, accessorName, proto)
      }
    }
  }

  toJSON(): Ambrosia {
    var result: { [key: string]: any } = {};
    var props: string[] = this.props();

    for (var i = 0; i < props.length; i++) {
      var key: string = props[i];
      var val: any = this[key];

      result[key] = val;
    }

    return <Ambrosia> <any> result;
  }

  private bindEverything() {
    var fns: any[] = [];

    for (var prop in this) {
      if (!this.hasGetterAndSetter(Object.getPrototypeOf(this), prop) && isFunction(this[prop]) && !(prop in Ambrosia.prototype)) {
        fns.push(prop);
      }
    }

    if (fns.length > 0) {
      for (var i = 0; i < fns.length; i++) {
        this[fns[i]] = (<Function> this[fns[i]]).bind(this);
      }
    }
  }

  /**
    Override any getter/setter pairs with additional functionality: they will now trigger
    events when used.
  */
  private overrideSetterGetter(pd: PropertyDescriptor, accessorName: string, proto: any) {
    // overrwrite property getters with our own

    Object.defineProperty(proto, accessorName, {
      get: pd.get,
      set: function(val) {
        pd.set.bind(this)(val)

        this.trigger('change');
        this.trigger('change:' + accessorName);
        this.trigger('change:' + accessorName + ':' + val);
      },
      enumerable: true,
      configurable: true
    });
  }

  /**
    Trigger an event on this object, optionally passing in additional arguments to
    any callback functions.
  */
  trigger(eventName: string, ...args: any[]) {
    var listenerList: EventCB[] = this.listeners[eventName];

    if (!listenerList) return;

    for (var i = 0; i < listenerList.length; i++) {
      listenerList[i].apply(this, args);
    }
  }

  private listenToHelper(target: Ambrosia, eventName: string, callback: EventCB, once: boolean) {
    if (eventName.indexOf("&&") !== -1) {
      var split = eventName.split("&&");
      var condition = split[1];
      eventName = split[0];
    }

    var listenerList: EventCB[] = target.listeners[eventName];
    if (!listenerList) target.listeners[eventName] = [];

    var removeCB: () => void;
    var modifiedCallback: EventCB = (...args: any[]) => {
      if ((condition && target[condition]) || !condition) {
        callback.apply(this, args);

        if (once) removeCB();
      }
    };

    removeCB = () => {
      var idx: number = target.listeners[eventName].indexOf(modifiedCallback);

      target.listeners[eventName].splice(idx, 1);
    }

    target.listeners[eventName].push(modifiedCallback);
  }

  /**
    Listen to some event `eventName` on `target`, calling `callback` when it is fired.

    Appending && and a condition to the end of `eventName` will only trigger `callback` if
    target.condition is true.
  */
  listenTo(target: Ambrosia, eventName: string, callback: EventCB) {
    if (!target) throw "target doesn't exist!";

    this.listenToHelper(target, eventName, callback, false);
  }

  /**
    Listen to some event `eventName` on `target`, calling `callback` when it is fired, and
    then removing this callback.

    Appending && and a condition to the end of `eventName` will only trigger `callback` if
    target.condition is true.
  */
  listenToOnce(target: Ambrosia, eventName: string, callback: EventCB) {
    if (!target) throw "target doesn't exist!";

    this.listenToHelper(target, eventName, callback, true);
  }
}
}