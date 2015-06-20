# ambrosia.ts

`ambrosia.ts` is a TypeScript microframework that gives you key-value observation and a couple of other small, handy features. If you've used Backbone.js, think of it as the evented parts of Backbone, but using plain old JavaScript objects, rather than having to extend and use Backbone's objects. 

If you haven't used Backbone, just look at the code samples.

## Features

### Key-Value Observation

It's what you're here for, right? 

**Keys and Values**

    class PaintCanvas extends Ambrosia {
      @prop width = 400;
      @prop height = 200;
    }

Now we have a class with two properties, and changing these properties will cause events to be triggered! 

Notice how we use TypeScript decorators to inform Ambrosia that the `width` and `height` properties should be observed. (These will silently create `_width` and `_height` backing properties on the object. You can feel free to use them, if necessary.)

**Observation:**

    var canvas = new PaintCanvas();
    
    canvas.listenTo(canvas, "change", () =>  console.log("Something changed!"));
    canvas.listenTo(canvas, "change:width", () =>  console.log("Width changed!"));
    canvas.listenTo(canvas, "change:width:5", () =>  console.log("Width changed to 5!"));

    canvas.width = 5; // Triggers all 3 of the above events
    canvas.height = 1; // Triggers just the first one

### Validated properties

Ambrosia also provides validated properties:

    class PaintCanvas extends Ambrosia {
      @validatedProp(PaintCanvas.validateWidth) width: number = 400;
      
      public static validateKey(width: number): boolean {
        return width <= 500 && width >= 0;
      }
    }

Now let's see what happens:

    var canvas = new PaintCanvas();
    
    canvas.width = 100; // fine
    canvas.width = 0; // still fine
    canvas.width = 500; // *not* fine, logs to console.error and canvas.width does not change:
    
    console.log(canvas.width); // 0

### Listening to events

Ambrosia provides `listenTo` - inspired by Backbone:

    listenTo(target: Ambrosia, eventName: string, callback: (...attrs: any[]) => any)

There's also `listenToOnce` for when you're only concerned with the first time an event is fired:

    listenToOnce(target: Ambrosia, eventName: string, callback: (...attrs: any[]) => any)

### Specific events

You can listen to the following:

* "change" - Any time anything is changed
* "change:foo" - Any time `foo` is changed
* "change:foo:5" - Any time `foo` is changed to `5`
* "change:foo&&bar" - Any time `foo` is changed on an object, and `thatObject.bar` is truthy.

### Triggering events

Feel free to trigger your own events:

    myObject.listenTo(myObject, "woohoo", function(a: number, b: number) { console.log(a, b); })
    myObject.trigger("woohoo", 5, 6); // Will console.log 5 and 6

### Is that it?

Yes. I said it was a microframework, not a macroframework. Or angularjs. :-)

## Why did you make it?

I've been building a lot of projects in TypeScript, and as I've been doing this I noticed that a couple of small helper classes and functions would follow me from project to project, because they were handy to have around pretty much anywhere. I gradually added on to them until they got to the point where Ambrosia is today.

## Why did you call it Ambrosia?

I decided to think of a name, and it was the first word that popped into my head. I was in a Philz at the time, which may have primed me. :)

## Future

I'd like to add Dependency Injection. Decorators in TypeScript are a rather unexplored feature (unsurprisingly, since they're so new), but I think they could allow DI to be done in a really elegant way. 

`@inject`, anyone?
