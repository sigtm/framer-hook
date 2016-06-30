require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"Hook":[function(require,module,exports){

/*
--------------------------------------------------------------------------------
Hook module for Framer
--------------------------------------------------------------------------------

The Hook module simply expands the Layer prototype, and lets you make any
numeric Layer property follow another property - either its own or another
object's - via a spring or gravity attraction.


--------------------------------------------------------------------------------
Example: Layered animation (eased + spring)
--------------------------------------------------------------------------------

myLayer = new Layer

 * Make our own custom property for the x property to follow
myLayer.easedX = 0

 * Hook x to easedX via a spring
myLayer.hook
	property: "x"
	targetProperty: "easedX"
	type: "spring(150, 15)"

 * Animate easedX
myLayer.animate
	properties:
		easedX: 200
	time: 0.15
	curve: "cubic-bezier(0.2, 0, 0.4, 1)"

NOTE: 
To attach both the x and y position, use "pos", "midPos" or "maxPos" as the
property/targetProperty.


--------------------------------------------------------------------------------
Example: Hooking property to another layer
--------------------------------------------------------------------------------

target = new Layer
hooked = new Layer

hooked.hook
	property: "scale"
	to: target
	type: "spring(150, 15)"

The "hooked" layer's scale will now continuously follow the target layer's scale
with a spring animation.


--------------------------------------------------------------------------------
layer.hook(options)
--------------------------------------------------------------------------------

Options are passed as a single object, like you would for a new Layer.
The options object takes the following properties:


property [String]
-----------------
The property you'd like to hook onto another object's property


type [String]
-------------
Either "spring(strength, friction)" or "gravity(strength, drag)". Only the last
specified drag value is used for each property, since it is only applied to
each property once (and only if it has a gravity hook applied to it.)


to [Object] (Optional)
----------------------
The object to attach it to. Defaults to itself.


targetProperty [String] (Optional)
----------------------------------
Specify the target object's property to follow, if you don't want to follow
the same property that the hook is applied to.


modulator [Function] (Optional)
-------------------------------
The modulator function receives the target property's value, and lets you
modify it before it is fed into the physics calculations. Useful for anything
from standard Utils.modulate() type stuff to snapping and conditional values.


zoom [Number] (Optional)
------------------------
This factor defines the distance that 1px represents in regards to gravity and
drag calculations. Only one value is stored per layer, so specifying it
overwrites its existing value. Default is 100.


--------------------------------------------------------------------------------
layer.unHook(property, object)
--------------------------------------------------------------------------------

This removes all hooks for a given property and target object. Example:

 * Hook it
layer.hook
	property: "x"
	to: "otherlayer"
	targetProperty: "y"
	type: "spring(200,20)"

 * Unhook it
layer.unHook "x", otherlayer


--------------------------------------------------------------------------------
layer.onHookUpdate(delta)
--------------------------------------------------------------------------------

After a layer is done applying accelerations to its hooked properties, it calls
onHookUpdate() at the end of each frame, if it is defined. This is an easy way
to animate or trigger other stuff, perhaps based on your layer's updated
properties or velocities.

The delta value from the Framer loop is passed on to onHookUpdate() as well,
which is the time in seconds since the last animation frame.

Note that if you unhook all your hooks, onHookUpdate() will of course no longer
be called for that layer.
 */
if (!String.prototype.includes) {
  String.prototype.includes = function(search, start) {
    'use strict';
    if (typeof start === 'number') {
      start = 0;
    }
    if (start + search.length > this.length) {
      return false;
    } else {
      return this.indexOf(search, start) !== -1;
    }
  };
}

Layer.prototype.hook = function(config) {
  var base, base1, f, name;
  if (!(config.property && config.type && (config.to || config.targetProperty))) {
    throw new Error('layer.hook() needs a property, a hook type and either a target object or target property to work');
  }
  if (this.hooks == null) {
    this.hooks = {
      hooks: [],
      velocities: {},
      defs: {
        zoom: 100,
        getDrag: (function(_this) {
          return function(velocity, drag, zoom) {
            velocity /= zoom;
            drag = -(drag / 10) * velocity * velocity * velocity / Math.abs(velocity);
            if (_.isNaN(drag)) {
              return 0;
            } else {
              return drag;
            }
          };
        })(this),
        getGravity: (function(_this) {
          return function(strength, distance, zoom) {
            var dist;
            dist = Math.max(1, distance / zoom);
            return strength * zoom / (dist * dist);
          };
        })(this)
      }
    };
  }
  if (config.zoom) {
    this.hooks.zoom = config.zoom;
  }
  f = Utils.parseFunction(config.type);
  config.type = f.name;
  config.strength = f.args[0];
  config.friction = f.args[1] || 0;
  if (config.targetProperty == null) {
    config.targetProperty = config.property;
  }
  if (config.to == null) {
    config.to = this;
  }
  if (config.property.toLowerCase().includes('pos')) {
    config.prop = 'pos';
    if (config.property.toLowerCase().includes('mid')) {
      config.thisX = 'midX';
      config.thisY = 'midY';
    } else if (config.property.toLowerCase().includes('max')) {
      config.thisX = 'maxX';
      config.thisY = 'maxY';
    } else {
      config.thisX = 'x';
      config.thisY = 'y';
    }
    if (config.targetProperty.toLowerCase().includes('mid')) {
      config.toX = 'midX';
      config.toY = 'midY';
    } else if (config.targetProperty.toLowerCase().includes('max')) {
      config.toX = 'maxX';
      config.toY = 'maxY';
    } else {
      config.toX = 'x';
      config.toY = 'y';
    }
  } else {
    config.prop = config.property;
  }
  this.hooks.hooks.push(config);
  if ((base = this.hooks.velocities)[name = config.prop] == null) {
    base[name] = config.prop === 'pos' ? {
      x: 0,
      y: 0
    } : 0;
  }
  return (base1 = this.hooks).emitter != null ? base1.emitter : base1.emitter = Framer.Loop.on('render', this.hookLoop, this);
};

Layer.prototype.unHook = function(property, object) {
  var prop, remaining;
  if (!this.hooks) {
    return;
  }
  prop = property.toLowerCase().includes('pos') ? 'pos' : property;
  this.hooks.hooks = this.hooks.hooks.filter(function(hook) {
    return hook.to !== object || hook.property !== property;
  });
  if (this.hooks.hooks.length === 0) {
    delete this.hooks;
    Framer.Loop.removeListener('render', this.hookLoop);
    return;
  }
  remaining = this.hooks.hooks.filter(function(hook) {
    return prop === hook.prop;
  });
  if (remaining.length === 0) {
    return delete this.hooks.velocities[prop];
  }
};

Layer.prototype.hookLoop = function(delta) {
  var acceleration, damper, drag, force, gravity, hook, i, len, name, prop, ref, ref1, target, vLength, vector, velocity;
  if (this.hooks) {
    acceleration = {};
    drag = {};
    ref = this.hooks.hooks;
    for (i = 0, len = ref.length; i < len; i++) {
      hook = ref[i];
      if (hook.prop === 'pos') {
        if (acceleration.pos == null) {
          acceleration.pos = {
            x: 0,
            y: 0
          };
        }
        target = {
          x: hook.to[hook.toX],
          y: hook.to[hook.toY]
        };
        if (hook.modulator) {
          target = hook.modulator(target);
        }
        vector = {
          x: target.x - this[hook.thisX],
          y: target.y - this[hook.thisY]
        };
        vLength = Math.sqrt((vector.x * vector.x) + (vector.y * vector.y));
        if (hook.type === 'spring') {
          damper = {
            x: -hook.friction * this.hooks.velocities.pos.x,
            y: -hook.friction * this.hooks.velocities.pos.y
          };
          vector.x *= hook.strength;
          vector.y *= hook.strength;
          acceleration.pos.x += (vector.x + damper.x) * delta;
          acceleration.pos.y += (vector.y + damper.y) * delta;
        } else if (hook.type === 'gravity') {
          drag.pos = hook.friction;
          gravity = this.hooks.defs.getGravity(hook.strength, vLength, this.hooks.defs.zoom);
          vector.x *= gravity / vLength;
          vector.y *= gravity / vLength;
          acceleration.pos.x += vector.x * delta;
          acceleration.pos.y += vector.y * delta;
        }
      } else {
        if (acceleration[name = hook.prop] == null) {
          acceleration[name] = 0;
        }
        target = hook.to[hook.targetProperty];
        if (hook.modulator) {
          target = hook.modulator(target);
        }
        vector = target - this[hook.prop];
        if (hook.type === 'spring') {
          force = vector * hook.strength;
          damper = -hook.friction * this.hooks.velocities[hook.prop];
          acceleration[hook.prop] += (force + damper) * delta;
        } else if (hook.type === 'gravity') {
          drag[hook.prop] = hook.friction;
          force = this.hooks.defs.getGravity(hook.strength, vector, this.hooks.defs.zoom);
          acceleration[hook.prop] += force * delta;
        }
      }
    }
    ref1 = this.hooks.velocities;
    for (prop in ref1) {
      velocity = ref1[prop];
      if (prop === 'pos') {
        if (drag.pos) {
          velocity.x += this.hooks.defs.getDrag(velocity.x, drag.pos, this.hooks.defs.zoom);
          velocity.y += this.hooks.defs.getDrag(velocity.y, drag.pos, this.hooks.defs.zoom);
        }
        velocity.x += acceleration.pos.x;
        velocity.y += acceleration.pos.y;
        this.x += velocity.x * delta;
        this.y += velocity.y * delta;
      } else {
        if (drag[prop]) {
          this.hooks.velocities[prop] += this.hooks.defs.getDrag(this.hooks.velocities[prop], drag[prop], this.hooks.defs.zoom);
        }
        this.hooks.velocities[prop] += acceleration[prop];
        this[prop] += this.hooks.velocities[prop] * delta;
      }
    }
    return typeof this.onHookUpdate === "function" ? this.onHookUpdate(delta) : void 0;
  }
};


},{}]},{},[])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvc2lndXJkL1JlcG9zL2ZyYW1lci1ob29rL2hvb2stZXhhbXBsZS1zcHJpbmcuZnJhbWVyL21vZHVsZXMvSG9vay5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7O0FDQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF1SUEsSUFBQSxDQUFPLE1BQU0sQ0FBQyxTQUFTLENBQUMsUUFBeEI7RUFDQyxNQUFNLENBQUEsU0FBRSxDQUFBLFFBQVIsR0FBbUIsU0FBQyxNQUFELEVBQVMsS0FBVDtJQUNsQjtJQUNBLElBQWEsT0FBTyxLQUFQLEtBQWdCLFFBQTdCO01BQUEsS0FBQSxHQUFRLEVBQVI7O0lBRUEsSUFBRyxLQUFBLEdBQVEsTUFBTSxDQUFDLE1BQWYsR0FBd0IsSUFBSSxDQUFDLE1BQWhDO0FBQ0MsYUFBTyxNQURSO0tBQUEsTUFBQTtBQUdDLGFBQU8sSUFBQyxDQUFBLE9BQUQsQ0FBUyxNQUFULEVBQWlCLEtBQWpCLENBQUEsS0FBNkIsQ0FBQyxFQUh0Qzs7RUFKa0IsRUFEcEI7OztBQVlBLEtBQUssQ0FBQSxTQUFFLENBQUEsSUFBUCxHQUFjLFNBQUMsTUFBRDtBQUViLE1BQUE7RUFBQSxJQUFBLENBQUEsQ0FBMEgsTUFBTSxDQUFDLFFBQVAsSUFBb0IsTUFBTSxDQUFDLElBQTNCLElBQW9DLENBQUMsTUFBTSxDQUFDLEVBQVAsSUFBYSxNQUFNLENBQUMsY0FBckIsQ0FBOUosQ0FBQTtBQUFBLFVBQVUsSUFBQSxLQUFBLENBQU0sa0dBQU4sRUFBVjs7O0lBR0EsSUFBQyxDQUFBLFFBQ0E7TUFBQSxLQUFBLEVBQU8sRUFBUDtNQUNBLFVBQUEsRUFBWSxFQURa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QUtBLFFBQVEsQ0FBQyxDQUFULElBQWMsWUFBWSxDQUFDLEdBQUcsQ0FBQztRQUMvQixRQUFRLENBQUMsQ0FBVCxJQUFjLFlBQVksQ0FBQyxHQUFHLENBQUM7UUFHL0IsSUFBQyxDQUFBLENBQUQsSUFBTSxRQUFRLENBQUMsQ0FBVCxHQUFhO1FBQ25CLElBQUMsQ0FBQSxDQUFELElBQU0sUUFBUSxDQUFDLENBQVQsR0FBYSxNQWJwQjtPQUFBLE1BQUE7UUFrQkMsSUFBRyxJQUFLLENBQUEsSUFBQSxDQUFSO1VBQ0MsSUFBQyxDQUFBLEtBQUssQ0FBQyxVQUFXLENBQUEsSUFBQSxDQUFsQixJQUEyQixJQUFDLENBQUEsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFaLENBQW9CLElBQUMsQ0FBQSxLQUFLLENBQUMsVUFBVyxDQUFBLElBQUEsQ0FBdEMsRUFBNkMsSUFBSyxDQUFBLElBQUEsQ0FBbEQsRUFBeUQsSUFBQyxDQUFBLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBckUsRUFENUI7O1FBSUEsSUFBQyxDQUFBLEtBQUssQ0FBQyxVQUFXLENBQUEsSUFBQSxDQUFsQixJQUEyQixZQUFhLENBQUEsSUFBQTtRQUd4QyxJQUFFLENBQUEsSUFBQSxDQUFGLElBQVcsSUFBQyxDQUFBLEtBQUssQ0FBQyxVQUFXLENBQUEsSUFBQSxDQUFsQixHQUEwQixNQXpCdEM7O0FBRkQ7cURBNkJBLElBQUMsQ0FBQSxhQUFjLGdCQTFHaEI7O0FBRmlCIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIiMjI1xuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbkhvb2sgbW9kdWxlIGZvciBGcmFtZXJcbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cblRoZSBIb29rIG1vZHVsZSBzaW1wbHkgZXhwYW5kcyB0aGUgTGF5ZXIgcHJvdG90eXBlLCBhbmQgbGV0cyB5b3UgbWFrZSBhbnlcbm51bWVyaWMgTGF5ZXIgcHJvcGVydHkgZm9sbG93IGFub3RoZXIgcHJvcGVydHkgLSBlaXRoZXIgaXRzIG93biBvciBhbm90aGVyXG5vYmplY3QncyAtIHZpYSBhIHNwcmluZyBvciBncmF2aXR5IGF0dHJhY3Rpb24uXG5cblxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbkV4YW1wbGU6IExheWVyZWQgYW5pbWF0aW9uIChlYXNlZCArIHNwcmluZylcbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbm15TGF5ZXIgPSBuZXcgTGF5ZXJcblxuIyBNYWtlIG91ciBvd24gY3VzdG9tIHByb3BlcnR5IGZvciB0aGUgeCBwcm9wZXJ0eSB0byBmb2xsb3dcbm15TGF5ZXIuZWFzZWRYID0gMFxuXG4jIEhvb2sgeCB0byBlYXNlZFggdmlhIGEgc3ByaW5nXG5teUxheWVyLmhvb2tcblx0cHJvcGVydHk6IFwieFwiXG5cdHRhcmdldFByb3BlcnR5OiBcImVhc2VkWFwiXG5cdHR5cGU6IFwic3ByaW5nKDE1MCwgMTUpXCJcblxuIyBBbmltYXRlIGVhc2VkWFxubXlMYXllci5hbmltYXRlXG5cdHByb3BlcnRpZXM6XG5cdFx0ZWFzZWRYOiAyMDBcblx0dGltZTogMC4xNVxuXHRjdXJ2ZTogXCJjdWJpYy1iZXppZXIoMC4yLCAwLCAwLjQsIDEpXCJcblxuTk9URTogXG5UbyBhdHRhY2ggYm90aCB0aGUgeCBhbmQgeSBwb3NpdGlvbiwgdXNlIFwicG9zXCIsIFwibWlkUG9zXCIgb3IgXCJtYXhQb3NcIiBhcyB0aGVcbnByb3BlcnR5L3RhcmdldFByb3BlcnR5LlxuXG5cbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5FeGFtcGxlOiBIb29raW5nIHByb3BlcnR5IHRvIGFub3RoZXIgbGF5ZXJcbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbnRhcmdldCA9IG5ldyBMYXllclxuaG9va2VkID0gbmV3IExheWVyXG5cbmhvb2tlZC5ob29rXG5cdHByb3BlcnR5OiBcInNjYWxlXCJcblx0dG86IHRhcmdldFxuXHR0eXBlOiBcInNwcmluZygxNTAsIDE1KVwiXG5cblRoZSBcImhvb2tlZFwiIGxheWVyJ3Mgc2NhbGUgd2lsbCBub3cgY29udGludW91c2x5IGZvbGxvdyB0aGUgdGFyZ2V0IGxheWVyJ3Mgc2NhbGVcbndpdGggYSBzcHJpbmcgYW5pbWF0aW9uLlxuXG5cbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5sYXllci5ob29rKG9wdGlvbnMpXG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5PcHRpb25zIGFyZSBwYXNzZWQgYXMgYSBzaW5nbGUgb2JqZWN0LCBsaWtlIHlvdSB3b3VsZCBmb3IgYSBuZXcgTGF5ZXIuXG5UaGUgb3B0aW9ucyBvYmplY3QgdGFrZXMgdGhlIGZvbGxvd2luZyBwcm9wZXJ0aWVzOlxuXG5cbnByb3BlcnR5IFtTdHJpbmddXG4tLS0tLS0tLS0tLS0tLS0tLVxuVGhlIHByb3BlcnR5IHlvdSdkIGxpa2UgdG8gaG9vayBvbnRvIGFub3RoZXIgb2JqZWN0J3MgcHJvcGVydHlcblxuXG50eXBlIFtTdHJpbmddXG4tLS0tLS0tLS0tLS0tXG5FaXRoZXIgXCJzcHJpbmcoc3RyZW5ndGgsIGZyaWN0aW9uKVwiIG9yIFwiZ3Jhdml0eShzdHJlbmd0aCwgZHJhZylcIi4gT25seSB0aGUgbGFzdFxuc3BlY2lmaWVkIGRyYWcgdmFsdWUgaXMgdXNlZCBmb3IgZWFjaCBwcm9wZXJ0eSwgc2luY2UgaXQgaXMgb25seSBhcHBsaWVkIHRvXG5lYWNoIHByb3BlcnR5IG9uY2UgKGFuZCBvbmx5IGlmIGl0IGhhcyBhIGdyYXZpdHkgaG9vayBhcHBsaWVkIHRvIGl0LilcblxuXG50byBbT2JqZWN0XSAoT3B0aW9uYWwpXG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5UaGUgb2JqZWN0IHRvIGF0dGFjaCBpdCB0by4gRGVmYXVsdHMgdG8gaXRzZWxmLlxuXG5cbnRhcmdldFByb3BlcnR5IFtTdHJpbmddIChPcHRpb25hbClcbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblNwZWNpZnkgdGhlIHRhcmdldCBvYmplY3QncyBwcm9wZXJ0eSB0byBmb2xsb3csIGlmIHlvdSBkb24ndCB3YW50IHRvIGZvbGxvd1xudGhlIHNhbWUgcHJvcGVydHkgdGhhdCB0aGUgaG9vayBpcyBhcHBsaWVkIHRvLlxuXG5cbm1vZHVsYXRvciBbRnVuY3Rpb25dIChPcHRpb25hbClcbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblRoZSBtb2R1bGF0b3IgZnVuY3Rpb24gcmVjZWl2ZXMgdGhlIHRhcmdldCBwcm9wZXJ0eSdzIHZhbHVlLCBhbmQgbGV0cyB5b3Vcbm1vZGlmeSBpdCBiZWZvcmUgaXQgaXMgZmVkIGludG8gdGhlIHBoeXNpY3MgY2FsY3VsYXRpb25zLiBVc2VmdWwgZm9yIGFueXRoaW5nXG5mcm9tIHN0YW5kYXJkIFV0aWxzLm1vZHVsYXRlKCkgdHlwZSBzdHVmZiB0byBzbmFwcGluZyBhbmQgY29uZGl0aW9uYWwgdmFsdWVzLlxuXG5cbnpvb20gW051bWJlcl0gKE9wdGlvbmFsKVxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5UaGlzIGZhY3RvciBkZWZpbmVzIHRoZSBkaXN0YW5jZSB0aGF0IDFweCByZXByZXNlbnRzIGluIHJlZ2FyZHMgdG8gZ3Jhdml0eSBhbmRcbmRyYWcgY2FsY3VsYXRpb25zLiBPbmx5IG9uZSB2YWx1ZSBpcyBzdG9yZWQgcGVyIGxheWVyLCBzbyBzcGVjaWZ5aW5nIGl0XG5vdmVyd3JpdGVzIGl0cyBleGlzdGluZyB2YWx1ZS4gRGVmYXVsdCBpcyAxMDAuXG5cblxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbmxheWVyLnVuSG9vayhwcm9wZXJ0eSwgb2JqZWN0KVxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuVGhpcyByZW1vdmVzIGFsbCBob29rcyBmb3IgYSBnaXZlbiBwcm9wZXJ0eSBhbmQgdGFyZ2V0IG9iamVjdC4gRXhhbXBsZTpcblxuIyBIb29rIGl0XG5sYXllci5ob29rXG5cdHByb3BlcnR5OiBcInhcIlxuXHR0bzogXCJvdGhlcmxheWVyXCJcblx0dGFyZ2V0UHJvcGVydHk6IFwieVwiXG5cdHR5cGU6IFwic3ByaW5nKDIwMCwyMClcIlxuXG4jIFVuaG9vayBpdFxubGF5ZXIudW5Ib29rIFwieFwiLCBvdGhlcmxheWVyXG5cblxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbmxheWVyLm9uSG9va1VwZGF0ZShkZWx0YSlcbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbkFmdGVyIGEgbGF5ZXIgaXMgZG9uZSBhcHBseWluZyBhY2NlbGVyYXRpb25zIHRvIGl0cyBob29rZWQgcHJvcGVydGllcywgaXQgY2FsbHNcbm9uSG9va1VwZGF0ZSgpIGF0IHRoZSBlbmQgb2YgZWFjaCBmcmFtZSwgaWYgaXQgaXMgZGVmaW5lZC4gVGhpcyBpcyBhbiBlYXN5IHdheVxudG8gYW5pbWF0ZSBvciB0cmlnZ2VyIG90aGVyIHN0dWZmLCBwZXJoYXBzIGJhc2VkIG9uIHlvdXIgbGF5ZXIncyB1cGRhdGVkXG5wcm9wZXJ0aWVzIG9yIHZlbG9jaXRpZXMuXG5cblRoZSBkZWx0YSB2YWx1ZSBmcm9tIHRoZSBGcmFtZXIgbG9vcCBpcyBwYXNzZWQgb24gdG8gb25Ib29rVXBkYXRlKCkgYXMgd2VsbCxcbndoaWNoIGlzIHRoZSB0aW1lIGluIHNlY29uZHMgc2luY2UgdGhlIGxhc3QgYW5pbWF0aW9uIGZyYW1lLlxuXG5Ob3RlIHRoYXQgaWYgeW91IHVuaG9vayBhbGwgeW91ciBob29rcywgb25Ib29rVXBkYXRlKCkgd2lsbCBvZiBjb3Vyc2Ugbm8gbG9uZ2VyXG5iZSBjYWxsZWQgZm9yIHRoYXQgbGF5ZXIuXG5cbiMjI1xuXG5cbiMgU2luY2Ugb2xkZXIgdmVyc2lvbnMgb2YgU2FmYXJpIHNlZW0gdG8gYmUgbWlzc2luZyBTdHJpbmcucHJvdG90eXBlLmluY2x1ZGVzKClcblxudW5sZXNzIFN0cmluZy5wcm90b3R5cGUuaW5jbHVkZXNcblx0U3RyaW5nOjppbmNsdWRlcyA9IChzZWFyY2gsIHN0YXJ0KSAtPlxuXHRcdCd1c2Ugc3RyaWN0J1xuXHRcdHN0YXJ0ID0gMCBpZiB0eXBlb2Ygc3RhcnQgaXMgJ251bWJlcidcblxuXHRcdGlmIHN0YXJ0ICsgc2VhcmNoLmxlbmd0aCA+IHRoaXMubGVuZ3RoXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0ZWxzZVxuXHRcdFx0cmV0dXJuIEBpbmRleE9mKHNlYXJjaCwgc3RhcnQpIGlzbnQgLTFcblxuIyBFeHBhbmQgbGF5ZXJcblxuTGF5ZXI6Omhvb2sgPSAoY29uZmlnKSAtPlxuXG5cdHRocm93IG5ldyBFcnJvciAnbGF5ZXIuaG9vaygpIG5lZWRzIGEgcHJvcGVydHksIGEgaG9vayB0eXBlIGFuZCBlaXRoZXIgYSB0YXJnZXQgb2JqZWN0IG9yIHRhcmdldCBwcm9wZXJ0eSB0byB3b3JrJyB1bmxlc3MgY29uZmlnLnByb3BlcnR5IGFuZCBjb25maWcudHlwZSBhbmQgKGNvbmZpZy50byBvciBjb25maWcudGFyZ2V0UHJvcGVydHkpXG5cblx0IyBTaW5nbGUgYXJyYXkgZm9yIGFsbCBob29rcywgYXMgb3Bwb3NlZCB0byBuZXN0ZWQgYXJyYXlzIHBlciBwcm9wZXJ0eSwgYmVjYXVzZSBwZXJmb3JtYW5jZVxuXHRAaG9va3MgPz1cblx0XHRob29rczogW11cblx0XHR2ZWxvY2l0aWVzOiB7fVxuXHRcdGRlZnM6XG5cdFx0XHR6b29tOiAxMDBcblx0XHRcdGdldERyYWc6ICh2ZWxvY2l0eSwgZHJhZywgem9vbSkgPT5cblx0XHRcdFx0dmVsb2NpdHkgLz0gem9vbVxuXHRcdFx0XHQjIERpdmlkaW5nIGJ5IDEwIGlzIHVuc2NpZW50aWZpYywgYnV0IGl0IG1lYW5zIGEgdmFsdWUgb2YgMiBlcXVhbHMgcm91Z2hseSBhIDEwMGcgYmFsbCB3aXRoIDE1Y20gcmFkaXVzIGluIGFpclxuXHRcdFx0XHRkcmFnID0gLShkcmFnIC8gMTApICogdmVsb2NpdHkgKiB2ZWxvY2l0eSAqIHZlbG9jaXR5IC8gTWF0aC5hYnModmVsb2NpdHkpXG5cdFx0XHRcdGlmIF8uaXNOYU4oZHJhZykgdGhlbiByZXR1cm4gMCBlbHNlIHJldHVybiBkcmFnXG5cdFx0XHRnZXRHcmF2aXR5OiAoc3RyZW5ndGgsIGRpc3RhbmNlLCB6b29tKSA9PlxuXHRcdFx0XHRkaXN0ID0gTWF0aC5tYXgoMSwgZGlzdGFuY2UgLyB6b29tKVxuXHRcdFx0XHRyZXR1cm4gc3RyZW5ndGggKiB6b29tIC8gKGRpc3QgKiBkaXN0KVxuXG5cdCMgVXBkYXRlIHRoZSB6b29tIHZhbHVlIGlmIGdpdmVuXG5cdEBob29rcy56b29tID0gY29uZmlnLnpvb20gaWYgY29uZmlnLnpvb21cblxuXHQjIFBhcnNlIHBoeXNpY3MgY29uZmlnIHN0cmluZ1xuXHRmID0gVXRpbHMucGFyc2VGdW5jdGlvbiBjb25maWcudHlwZVxuXHRjb25maWcudHlwZSA9IGYubmFtZVxuXHRjb25maWcuc3RyZW5ndGggPSBmLmFyZ3NbMF1cblx0Y29uZmlnLmZyaWN0aW9uID0gZi5hcmdzWzFdIG9yIDBcblxuXHQjIERlZmF1bHQgdG8gc2FtZSB0YXJnZXRQcm9wZXJ0eSBvbiBzYW1lIG9iamVjdCAoaG9wZWZ1bGx5IHlvdSd2ZSBzZXQgYXQgbGVhc3Qgb25lIG9mIHRoZXNlIHRvIHNvbWV0aGluZyBlbHNlKVxuXHRjb25maWcudGFyZ2V0UHJvcGVydHkgPz0gY29uZmlnLnByb3BlcnR5XG5cdGNvbmZpZy50byA/PSBAXG5cblx0IyBBbGwgcG9zaXRpb24gYWNjZWxlcmF0aW9ucyBhcmUgYWRkZWQgdG8gYSBzaW5nbGUgJ3BvcycgdmVsb2NpdHkuIFN0b3JlIGFjdHVhbCBwcm9wZXJ0aWVzIHNvIHdlIGRvbid0IGhhdmUgdG8gZG8gaXQgYWdhaW4gZXZlcnkgZnJhbWVcblxuXHRpZiBjb25maWcucHJvcGVydHkudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyAncG9zJ1xuXHRcdGNvbmZpZy5wcm9wID0gJ3Bvcydcblx0XHRcblx0XHRpZiBjb25maWcucHJvcGVydHkudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyAnbWlkJ1xuXHRcdFx0Y29uZmlnLnRoaXNYID0gJ21pZFgnXG5cdFx0XHRjb25maWcudGhpc1kgPSAnbWlkWSdcblx0XHRcblx0XHRlbHNlIGlmIGNvbmZpZy5wcm9wZXJ0eS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzICdtYXgnXG5cdFx0XHRjb25maWcudGhpc1ggPSAnbWF4WCdcblx0XHRcdGNvbmZpZy50aGlzWSA9ICdtYXhZJ1xuXHRcdFxuXHRcdGVsc2Vcblx0XHRcdGNvbmZpZy50aGlzWCA9ICd4J1xuXHRcdFx0Y29uZmlnLnRoaXNZID0gJ3knXG5cdFx0XG5cdFx0aWYgY29uZmlnLnRhcmdldFByb3BlcnR5LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMgJ21pZCdcblx0XHRcdGNvbmZpZy50b1ggPSAnbWlkWCdcblx0XHRcdGNvbmZpZy50b1kgPSAnbWlkWSdcblx0XHRcblx0XHRlbHNlIGlmIGNvbmZpZy50YXJnZXRQcm9wZXJ0eS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzICdtYXgnXG5cdFx0XHRjb25maWcudG9YID0gJ21heFgnXG5cdFx0XHRjb25maWcudG9ZID0gJ21heFknXHRcdFxuXHRcdGVsc2Vcblx0XHRcdGNvbmZpZy50b1ggPSAneCdcblx0XHRcdGNvbmZpZy50b1kgPSAneSdcblx0XHRcblx0ZWxzZVxuXHRcdGNvbmZpZy5wcm9wID0gY29uZmlnLnByb3BlcnR5XG5cblx0IyBTYXZlIGhvb2sgdG8gQGhvb2tzIGFycmF5XHRcblx0QGhvb2tzLmhvb2tzLnB1c2goY29uZmlnKVxuXG5cdCMgQ3JlYXRlIHZlbG9jaXR5IHByb3BlcnR5IGlmIG5lY2Vzc2FyeVxuXHRAaG9va3MudmVsb2NpdGllc1tjb25maWcucHJvcF0gPz0gaWYgY29uZmlnLnByb3AgaXMgJ3BvcycgdGhlbiB7IHg6IDAsIHk6IDAgfSBlbHNlIDBcblxuXHQjIFVzZSBGcmFtZXIncyBhbmltYXRpb24gbG9vcCwgc2xpZ2h0bHkgbW9yZSByb2J1c3QgdGhhbiByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgZGlyZWN0bHlcblx0IyBTYXZlIHRoZSByZXR1cm5lZCBBbmltYXRpb25Mb29wIHJlZmVyZW5jZSB0byBtYWtlIHN1cmUgQGhvb2tMb29wIGlzbid0IGFkZGVkIG11bHRpcGxlIHRpbWVzIHBlciBsYXllclxuXHRAaG9va3MuZW1pdHRlciA/PSBGcmFtZXIuTG9vcC5vbigncmVuZGVyJywgQGhvb2tMb29wLCB0aGlzKVxuXG5MYXllcjo6dW5Ib29rID0gKHByb3BlcnR5LCBvYmplY3QpIC0+XG5cdFxuXHRyZXR1cm4gdW5sZXNzIEBob29rc1xuXG5cdHByb3AgPSBpZiBwcm9wZXJ0eS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzICdwb3MnIHRoZW4gJ3BvcycgZWxzZSBwcm9wZXJ0eVxuXG5cdCMgUmVtb3ZlIGFsbCBtYXRjaGVzXG5cdEBob29rcy5ob29rcyA9IEBob29rcy5ob29rcy5maWx0ZXIgKGhvb2spIC0+XG5cdFx0aG9vay50byBpc250IG9iamVjdCBvciBob29rLnByb3BlcnR5IGlzbnQgcHJvcGVydHlcblxuXHQjIElmIHRoZXJlIGFyZSBubyBob29rcyBsZWZ0LCBzaHV0IGl0IGRvd25cblx0aWYgQGhvb2tzLmhvb2tzLmxlbmd0aCBpcyAwXG5cdFx0ZGVsZXRlIEBob29rc1xuXHRcdEZyYW1lci5Mb29wLnJlbW92ZUxpc3RlbmVyICdyZW5kZXInLCBAaG9va0xvb3Bcblx0XHRyZXR1cm5cblxuXHQjIFN0aWxsIGhlcmU/IENoZWNrIGlmIHRoZXJlIGFyZSBhbnkgcmVtYWluaW5nIGhvb2tzIGFmZmVjdGluZyBzYW1lIHZlbG9jaXR5XG5cdHJlbWFpbmluZyA9IEBob29rcy5ob29rcy5maWx0ZXIgKGhvb2spIC0+XG5cdFx0cHJvcCBpcyBob29rLnByb3Bcblx0XHRcblx0IyBJZiBub3QsIGRlbGV0ZSB2ZWxvY2l0eSAob3RoZXJ3aXNlIGl0IHdvbid0IGJlIHJlc2V0IGlmIHlvdSBtYWtlIG5ldyBob29rIGZvciBzYW1lIHByb3BlcnR5KVxuXHRkZWxldGUgQGhvb2tzLnZlbG9jaXRpZXNbcHJvcF0gaWYgcmVtYWluaW5nLmxlbmd0aCBpcyAwXG5cbkxheWVyOjpob29rTG9vcCA9IChkZWx0YSkgLT5cblxuXHRpZiBAaG9va3NcblxuXHRcdCMgTXVsdGlwbGUgaG9va3MgY2FuIGFmZmVjdCB0aGUgc2FtZSBwcm9wZXJ0eS4gQWRkIGFjY2VsZXJhdGlvbnMgdG8gdGVtcG9yYXJ5IG9iamVjdCBzbyB0aGUgcHJvcGVydHkncyB2ZWxvY2l0eSBpcyB0aGUgc2FtZSBmb3IgYWxsIGNhbGN1bGF0aW9ucyB3aXRoaW4gdGhlIHNhbWUgYW5pbWF0aW9uIGZyYW1lXG5cdFx0YWNjZWxlcmF0aW9uID0ge31cblx0XHRcblx0XHQjIFNhdmUgZHJhZyBmb3IgZWFjaCBwcm9wZXJ0eSB0byB0aGlzIG9iamVjdCwgc2luY2Ugb25seSBtb3N0IHJlY2VudGx5IHNwZWNpZmllZCB2YWx1ZSBpcyB1c2VkIGZvciBlYWNoIHByb3BlcnR5XG5cdFx0ZHJhZyA9IHt9XG5cdFx0XG5cdFx0IyBBZGQgYWNjZWxlcmF0aW9uc1xuXHRcdGZvciBob29rIGluIEBob29rcy5ob29rc1xuXHRcdFxuXHRcdFx0aWYgaG9vay5wcm9wIGlzICdwb3MnXG5cblx0XHRcdFx0YWNjZWxlcmF0aW9uLnBvcyA/PSB7IHg6IDAsIHk6IDAgfVxuXG5cdFx0XHRcdHRhcmdldCA9IHsgeDogaG9vay50b1tob29rLnRvWF0sIHk6IGhvb2sudG9baG9vay50b1ldIH1cblxuXHRcdFx0XHR0YXJnZXQgPSBob29rLm1vZHVsYXRvcih0YXJnZXQpIGlmIGhvb2subW9kdWxhdG9yXG5cblx0XHRcdFx0dmVjdG9yID1cblx0XHRcdFx0XHR4OiB0YXJnZXQueCAtIEBbaG9vay50aGlzWF1cblx0XHRcdFx0XHR5OiB0YXJnZXQueSAtIEBbaG9vay50aGlzWV1cblx0XHRcdFx0XG5cdFx0XHRcdHZMZW5ndGggPSBNYXRoLnNxcnQoKHZlY3Rvci54ICogdmVjdG9yLngpICsgKHZlY3Rvci55ICogdmVjdG9yLnkpKVxuXG5cdFx0XHRcdGlmIGhvb2sudHlwZSBpcyAnc3ByaW5nJ1xuXG5cdFx0XHRcdFx0ZGFtcGVyID1cblx0XHRcdFx0XHRcdHg6IC1ob29rLmZyaWN0aW9uICogQGhvb2tzLnZlbG9jaXRpZXMucG9zLnhcblx0XHRcdFx0XHRcdHk6IC1ob29rLmZyaWN0aW9uICogQGhvb2tzLnZlbG9jaXRpZXMucG9zLnlcblxuXHRcdFx0XHRcdHZlY3Rvci54ICo9IGhvb2suc3RyZW5ndGhcblx0XHRcdFx0XHR2ZWN0b3IueSAqPSBob29rLnN0cmVuZ3RoXG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0YWNjZWxlcmF0aW9uLnBvcy54ICs9ICh2ZWN0b3IueCArIGRhbXBlci54KSAqIGRlbHRhXG5cdFx0XHRcdFx0YWNjZWxlcmF0aW9uLnBvcy55ICs9ICh2ZWN0b3IueSArIGRhbXBlci55KSAqIGRlbHRhXG5cdFx0XHRcdFxuXHRcdFx0XHRlbHNlIGlmIGhvb2sudHlwZSBpcyAnZ3Jhdml0eSdcblx0XHRcdFx0XG5cdFx0XHRcdFx0ZHJhZy5wb3MgPSBob29rLmZyaWN0aW9uXG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Z3Jhdml0eSA9IEBob29rcy5kZWZzLmdldEdyYXZpdHkoaG9vay5zdHJlbmd0aCwgdkxlbmd0aCwgQGhvb2tzLmRlZnMuem9vbSlcblxuXHRcdFx0XHRcdHZlY3Rvci54ICo9IGdyYXZpdHkgLyB2TGVuZ3RoXG5cdFx0XHRcdFx0dmVjdG9yLnkgKj0gZ3Jhdml0eSAvIHZMZW5ndGhcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRhY2NlbGVyYXRpb24ucG9zLnggKz0gdmVjdG9yLnggKiBkZWx0YVxuXHRcdFx0XHRcdGFjY2VsZXJhdGlvbi5wb3MueSArPSB2ZWN0b3IueSAqIGRlbHRhXG5cdFx0XHRcdFx0XHRcdFx0XHRcblx0XHRcdGVsc2Vcblx0XHRcdFx0XG5cdFx0XHRcdGFjY2VsZXJhdGlvbltob29rLnByb3BdID89IDBcblxuXHRcdFx0XHR0YXJnZXQgPSBob29rLnRvW2hvb2sudGFyZ2V0UHJvcGVydHldXG5cblx0XHRcdFx0dGFyZ2V0ID0gaG9vay5tb2R1bGF0b3IodGFyZ2V0KSBpZiBob29rLm1vZHVsYXRvclxuXG5cdFx0XHRcdHZlY3RvciA9IHRhcmdldCAtIEBbaG9vay5wcm9wXVxuXHRcdFx0XHRcblx0XHRcdFx0aWYgaG9vay50eXBlIGlzICdzcHJpbmcnXG5cblx0XHRcdFx0XHRmb3JjZSA9IHZlY3RvciAqIGhvb2suc3RyZW5ndGhcblx0XHRcdFx0XHRkYW1wZXIgPSAtaG9vay5mcmljdGlvbiAqIEBob29rcy52ZWxvY2l0aWVzW2hvb2sucHJvcF1cblxuXHRcdFx0XHRcdGFjY2VsZXJhdGlvbltob29rLnByb3BdICs9IChmb3JjZSArIGRhbXBlcikgKiBkZWx0YVxuXG5cdFx0XHRcdFxuXHRcdFx0XHRlbHNlIGlmIGhvb2sudHlwZSBpcyAnZ3Jhdml0eSdcblx0XG5cdFx0XHRcdFx0ZHJhZ1tob29rLnByb3BdID0gaG9vay5mcmljdGlvblxuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdGZvcmNlID0gQGhvb2tzLmRlZnMuZ2V0R3Jhdml0eShob29rLnN0cmVuZ3RoLCB2ZWN0b3IsIEBob29rcy5kZWZzLnpvb20pXG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0YWNjZWxlcmF0aW9uW2hvb2sucHJvcF0gKz0gZm9yY2UgKiBkZWx0YVxuXHRcdFxuXHRcdFxuXHRcdCMgQWRkIHZlbG9jaXRpZXMgdG8gcHJvcGVydGllcy4gRG9pbmcgdGhpcyBhdCB0aGUgZW5kIGluIGNhc2UgdGhlcmUgYXJlIG11bHRpcGxlIGhvb2tzIGFmZmVjdGluZyB0aGUgc2FtZSB2ZWxvY2l0eVxuXHRcdGZvciBwcm9wLCB2ZWxvY2l0eSBvZiBAaG9va3MudmVsb2NpdGllc1xuXHRcdFxuXHRcdFx0aWYgcHJvcCBpcyAncG9zJ1xuXG5cdFx0XHRcdCMgQWRkIGRyYWcsIGlmIGl0IGV4aXN0c1xuXHRcdFx0XHRpZiBkcmFnLnBvc1xuXHRcdFx0XHRcdHZlbG9jaXR5LnggKz0gQGhvb2tzLmRlZnMuZ2V0RHJhZyh2ZWxvY2l0eS54LCBkcmFnLnBvcywgQGhvb2tzLmRlZnMuem9vbSlcblx0XHRcdFx0XHR2ZWxvY2l0eS55ICs9IEBob29rcy5kZWZzLmdldERyYWcodmVsb2NpdHkueSwgZHJhZy5wb3MsIEBob29rcy5kZWZzLnpvb20pXG5cdFx0XHRcdFx0XG5cdFx0XHRcdCMgQWRkIGFjY2VsZXJhdGlvbiB0byB2ZWxvY2l0eVxuXHRcdFx0XHR2ZWxvY2l0eS54ICs9IGFjY2VsZXJhdGlvbi5wb3MueFxuXHRcdFx0XHR2ZWxvY2l0eS55ICs9IGFjY2VsZXJhdGlvbi5wb3MueVxuXHRcdFx0XHRcblx0XHRcdFx0IyBBZGQgdmVsb2NpdHkgdG8gcG9zaXRpb25cblx0XHRcdFx0QHggKz0gdmVsb2NpdHkueCAqIGRlbHRhXG5cdFx0XHRcdEB5ICs9IHZlbG9jaXR5LnkgKiBkZWx0YVxuXHRcdFx0XG5cdFx0XHRlbHNlXG5cdFx0XHRcblx0XHRcdFx0IyBBZGQgZHJhZywgaWYgaXQgZXhpc3RzXG5cdFx0XHRcdGlmIGRyYWdbcHJvcF1cblx0XHRcdFx0XHRAaG9va3MudmVsb2NpdGllc1twcm9wXSArPSBAaG9va3MuZGVmcy5nZXREcmFnKEBob29rcy52ZWxvY2l0aWVzW3Byb3BdLCBkcmFnW3Byb3BdLCBAaG9va3MuZGVmcy56b29tKVxuXHRcdFx0XHRcblx0XHRcdFx0IyBBZGQgYWNjZWxlcmF0aW9uIHRvIHZlbG9jaXR5XG5cdFx0XHRcdEBob29rcy52ZWxvY2l0aWVzW3Byb3BdICs9IGFjY2VsZXJhdGlvbltwcm9wXVxuXHRcdFx0XHRcblx0XHRcdFx0IyBBZGQgdmVsb2NpdHkgdG8gcHJvcGVydHlcblx0XHRcdFx0QFtwcm9wXSArPSBAaG9va3MudmVsb2NpdGllc1twcm9wXSAqIGRlbHRhXG5cblx0XHRAb25Ib29rVXBkYXRlPyhkZWx0YSkiXX0=
