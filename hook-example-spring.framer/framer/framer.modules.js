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
  var base, f, name;
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
  return Framer.Loop.on('render', this.hookLoop, this);
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvc2lndXJkL1JlcG9zL2ZyYW1lci1ob29rL2hvb2stZXhhbXBsZS1zcHJpbmcuZnJhbWVyL21vZHVsZXMvSG9vay5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7O0FDQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF1SUEsSUFBQSxDQUFPLE1BQU0sQ0FBQyxTQUFTLENBQUMsUUFBeEI7RUFDQyxNQUFNLENBQUEsU0FBRSxDQUFBLFFBQVIsR0FBbUIsU0FBQyxNQUFELEVBQVMsS0FBVDtJQUNsQjtJQUNBLElBQWEsT0FBTyxLQUFQLEtBQWdCLFFBQTdCO01BQUEsS0FBQSxHQUFRLEVBQVI7O0lBRUEsSUFBRyxLQUFBLEdBQVEsTUFBTSxDQUFDLE1BQWYsR0FBd0IsSUFBSSxDQUFDLE1BQWhDO0FBQ0MsYUFBTyxNQURSO0tBQUEsTUFBQTtBQUdDLGFBQU8sSUFBQyxDQUFBLE9BQUQsQ0FBUyxNQUFULEVBQWlCLEtBQWpCLENBQUEsS0FBNkIsQ0FBQyxFQUh0Qzs7RUFKa0IsRUFEcEI7OztBQVlBLEtBQUssQ0FBQSxTQUFFLENBQUEsSUFBUCxHQUFjLFNBQUMsTUFBRDtBQUViLE1BQUE7RUFBQSxJQUFBLENBQUEsQ0FBMEgsTUFBTSxDQUFDLFFBQVAsSUFBb0IsTUFBTSxDQUFDLElBQTNCLElBQW9DLENBQUMsTUFBTSxDQUFDLEVBQVAsSUFBYSxNQUFNLENBQUMsY0FBckIsQ0FBOUosQ0FBQTtBQUFBLFVBQVUsSUFBQSxLQUFBLENBQU0sa0dBQU4sRUFBVjs7O0lBR0EsSUFBQyxDQUFBLFFBQ0E7TUFBQSxLQUFBLEVBQU8s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OztRQUtBLFFBQVEsQ0FBQyxDQUFULElBQWMsWUFBWSxDQUFDLEdBQUcsQ0FBQztRQUMvQixRQUFRLENBQUMsQ0FBVCxJQUFjLFlBQVksQ0FBQyxHQUFHLENBQUM7UUFHL0IsSUFBQyxDQUFBLENBQUQsSUFBTSxRQUFRLENBQUMsQ0FBVCxHQUFhO1FBQ25CLElBQUMsQ0FBQSxDQUFELElBQU0sUUFBUSxDQUFDLENBQVQsR0FBYSxNQWJwQjtPQUFBLE1BQUE7UUFrQkMsSUFBRyxJQUFLLENBQUEsSUFBQSxDQUFSO1VBQ0MsSUFBQyxDQUFBLEtBQUssQ0FBQyxVQUFXLENBQUEsSUFBQSxDQUFsQixJQUEyQixJQUFDLENBQUEsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFaLENBQW9CLElBQUMsQ0FBQSxLQUFLLENBQUMsVUFBVyxDQUFBLElBQUEsQ0FBdEMsRUFBNkMsSUFBSyxDQUFBLElBQUEsQ0FBbEQsRUFBeUQsSUFBQyxDQUFBLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBckUsRUFENUI7O1FBSUEsSUFBQyxDQUFBLEtBQUssQ0FBQyxVQUFXLENBQUEsSUFBQSxDQUFsQixJQUEyQixZQUFhLENBQUEsSUFBQTtRQUd4QyxJQUFFLENBQUEsSUFBQSxDQUFGLElBQVcsSUFBQyxDQUFBLEtBQUssQ0FBQyxVQUFXLENBQUEsSUFBQSxDQUFsQixHQUEwQixNQXpCdEM7O0FBRkQ7cURBNkJBLElBQUMsQ0FBQSxhQUFjLGdCQTFHaEI7O0FBRmlCIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIiMjI1xuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbkhvb2sgbW9kdWxlIGZvciBGcmFtZXJcbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cblRoZSBIb29rIG1vZHVsZSBzaW1wbHkgZXhwYW5kcyB0aGUgTGF5ZXIgcHJvdG90eXBlLCBhbmQgbGV0cyB5b3UgbWFrZSBhbnlcbm51bWVyaWMgTGF5ZXIgcHJvcGVydHkgZm9sbG93IGFub3RoZXIgcHJvcGVydHkgLSBlaXRoZXIgaXRzIG93biBvciBhbm90aGVyXG5vYmplY3QncyAtIHZpYSBhIHNwcmluZyBvciBncmF2aXR5IGF0dHJhY3Rpb24uXG5cblxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbkV4YW1wbGU6IExheWVyZWQgYW5pbWF0aW9uIChlYXNlZCArIHNwcmluZylcbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbm15TGF5ZXIgPSBuZXcgTGF5ZXJcblxuIyBNYWtlIG91ciBvd24gY3VzdG9tIHByb3BlcnR5IGZvciB0aGUgeCBwcm9wZXJ0eSB0byBmb2xsb3dcbm15TGF5ZXIuZWFzZWRYID0gMFxuXG4jIEhvb2sgeCB0byBlYXNlZFggdmlhIGEgc3ByaW5nXG5teUxheWVyLmhvb2tcblx0cHJvcGVydHk6IFwieFwiXG5cdHRhcmdldFByb3BlcnR5OiBcImVhc2VkWFwiXG5cdHR5cGU6IFwic3ByaW5nKDE1MCwgMTUpXCJcblxuIyBBbmltYXRlIGVhc2VkWFxubXlMYXllci5hbmltYXRlXG5cdHByb3BlcnRpZXM6XG5cdFx0ZWFzZWRYOiAyMDBcblx0dGltZTogMC4xNVxuXHRjdXJ2ZTogXCJjdWJpYy1iZXppZXIoMC4yLCAwLCAwLjQsIDEpXCJcblxuTk9URTogXG5UbyBhdHRhY2ggYm90aCB0aGUgeCBhbmQgeSBwb3NpdGlvbiwgdXNlIFwicG9zXCIsIFwibWlkUG9zXCIgb3IgXCJtYXhQb3NcIiBhcyB0aGVcbnByb3BlcnR5L3RhcmdldFByb3BlcnR5LlxuXG5cbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5FeGFtcGxlOiBIb29raW5nIHByb3BlcnR5IHRvIGFub3RoZXIgbGF5ZXJcbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbnRhcmdldCA9IG5ldyBMYXllclxuaG9va2VkID0gbmV3IExheWVyXG5cbmhvb2tlZC5ob29rXG5cdHByb3BlcnR5OiBcInNjYWxlXCJcblx0dG86IHRhcmdldFxuXHR0eXBlOiBcInNwcmluZygxNTAsIDE1KVwiXG5cblRoZSBcImhvb2tlZFwiIGxheWVyJ3Mgc2NhbGUgd2lsbCBub3cgY29udGludW91c2x5IGZvbGxvdyB0aGUgdGFyZ2V0IGxheWVyJ3Mgc2NhbGVcbndpdGggYSBzcHJpbmcgYW5pbWF0aW9uLlxuXG5cbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5sYXllci5ob29rKG9wdGlvbnMpXG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5PcHRpb25zIGFyZSBwYXNzZWQgYXMgYSBzaW5nbGUgb2JqZWN0LCBsaWtlIHlvdSB3b3VsZCBmb3IgYSBuZXcgTGF5ZXIuXG5UaGUgb3B0aW9ucyBvYmplY3QgdGFrZXMgdGhlIGZvbGxvd2luZyBwcm9wZXJ0aWVzOlxuXG5cbnByb3BlcnR5IFtTdHJpbmddXG4tLS0tLS0tLS0tLS0tLS0tLVxuVGhlIHByb3BlcnR5IHlvdSdkIGxpa2UgdG8gaG9vayBvbnRvIGFub3RoZXIgb2JqZWN0J3MgcHJvcGVydHlcblxuXG50eXBlIFtTdHJpbmddXG4tLS0tLS0tLS0tLS0tXG5FaXRoZXIgXCJzcHJpbmcoc3RyZW5ndGgsIGZyaWN0aW9uKVwiIG9yIFwiZ3Jhdml0eShzdHJlbmd0aCwgZHJhZylcIi4gT25seSB0aGUgbGFzdFxuc3BlY2lmaWVkIGRyYWcgdmFsdWUgaXMgdXNlZCBmb3IgZWFjaCBwcm9wZXJ0eSwgc2luY2UgaXQgaXMgb25seSBhcHBsaWVkIHRvXG5lYWNoIHByb3BlcnR5IG9uY2UgKGFuZCBvbmx5IGlmIGl0IGhhcyBhIGdyYXZpdHkgaG9vayBhcHBsaWVkIHRvIGl0LilcblxuXG50byBbT2JqZWN0XSAoT3B0aW9uYWwpXG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5UaGUgb2JqZWN0IHRvIGF0dGFjaCBpdCB0by4gRGVmYXVsdHMgdG8gaXRzZWxmLlxuXG5cbnRhcmdldFByb3BlcnR5IFtTdHJpbmddIChPcHRpb25hbClcbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblNwZWNpZnkgdGhlIHRhcmdldCBvYmplY3QncyBwcm9wZXJ0eSB0byBmb2xsb3csIGlmIHlvdSBkb24ndCB3YW50IHRvIGZvbGxvd1xudGhlIHNhbWUgcHJvcGVydHkgdGhhdCB0aGUgaG9vayBpcyBhcHBsaWVkIHRvLlxuXG5cbm1vZHVsYXRvciBbRnVuY3Rpb25dIChPcHRpb25hbClcbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblRoZSBtb2R1bGF0b3IgZnVuY3Rpb24gcmVjZWl2ZXMgdGhlIHRhcmdldCBwcm9wZXJ0eSdzIHZhbHVlLCBhbmQgbGV0cyB5b3Vcbm1vZGlmeSBpdCBiZWZvcmUgaXQgaXMgZmVkIGludG8gdGhlIHBoeXNpY3MgY2FsY3VsYXRpb25zLiBVc2VmdWwgZm9yIGFueXRoaW5nXG5mcm9tIHN0YW5kYXJkIFV0aWxzLm1vZHVsYXRlKCkgdHlwZSBzdHVmZiB0byBzbmFwcGluZyBhbmQgY29uZGl0aW9uYWwgdmFsdWVzLlxuXG5cbnpvb20gW051bWJlcl0gKE9wdGlvbmFsKVxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5UaGlzIGZhY3RvciBkZWZpbmVzIHRoZSBkaXN0YW5jZSB0aGF0IDFweCByZXByZXNlbnRzIGluIHJlZ2FyZHMgdG8gZ3Jhdml0eSBhbmRcbmRyYWcgY2FsY3VsYXRpb25zLiBPbmx5IG9uZSB2YWx1ZSBpcyBzdG9yZWQgcGVyIGxheWVyLCBzbyBzcGVjaWZ5aW5nIGl0XG5vdmVyd3JpdGVzIGl0cyBleGlzdGluZyB2YWx1ZS4gRGVmYXVsdCBpcyAxMDAuXG5cblxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbmxheWVyLnVuSG9vayhwcm9wZXJ0eSwgb2JqZWN0KVxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuVGhpcyByZW1vdmVzIGFsbCBob29rcyBmb3IgYSBnaXZlbiBwcm9wZXJ0eSBhbmQgdGFyZ2V0IG9iamVjdC4gRXhhbXBsZTpcblxuIyBIb29rIGl0XG5sYXllci5ob29rXG5cdHByb3BlcnR5OiBcInhcIlxuXHR0bzogXCJvdGhlcmxheWVyXCJcblx0dGFyZ2V0UHJvcGVydHk6IFwieVwiXG5cdHR5cGU6IFwic3ByaW5nKDIwMCwyMClcIlxuXG4jIFVuaG9vayBpdFxubGF5ZXIudW5Ib29rIFwieFwiLCBvdGhlcmxheWVyXG5cblxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbmxheWVyLm9uSG9va1VwZGF0ZShkZWx0YSlcbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbkFmdGVyIGEgbGF5ZXIgaXMgZG9uZSBhcHBseWluZyBhY2NlbGVyYXRpb25zIHRvIGl0cyBob29rZWQgcHJvcGVydGllcywgaXQgY2FsbHNcbm9uSG9va1VwZGF0ZSgpIGF0IHRoZSBlbmQgb2YgZWFjaCBmcmFtZSwgaWYgaXQgaXMgZGVmaW5lZC4gVGhpcyBpcyBhbiBlYXN5IHdheVxudG8gYW5pbWF0ZSBvciB0cmlnZ2VyIG90aGVyIHN0dWZmLCBwZXJoYXBzIGJhc2VkIG9uIHlvdXIgbGF5ZXIncyB1cGRhdGVkXG5wcm9wZXJ0aWVzIG9yIHZlbG9jaXRpZXMuXG5cblRoZSBkZWx0YSB2YWx1ZSBmcm9tIHRoZSBGcmFtZXIgbG9vcCBpcyBwYXNzZWQgb24gdG8gb25Ib29rVXBkYXRlKCkgYXMgd2VsbCxcbndoaWNoIGlzIHRoZSB0aW1lIGluIHNlY29uZHMgc2luY2UgdGhlIGxhc3QgYW5pbWF0aW9uIGZyYW1lLlxuXG5Ob3RlIHRoYXQgaWYgeW91IHVuaG9vayBhbGwgeW91ciBob29rcywgb25Ib29rVXBkYXRlKCkgd2lsbCBvZiBjb3Vyc2Ugbm8gbG9uZ2VyXG5iZSBjYWxsZWQgZm9yIHRoYXQgbGF5ZXIuXG5cbiMjI1xuXG5cbiMgU2luY2Ugb2xkZXIgdmVyc2lvbnMgb2YgU2FmYXJpIHNlZW0gdG8gYmUgbWlzc2luZyBTdHJpbmcucHJvdG90eXBlLmluY2x1ZGVzKClcblxudW5sZXNzIFN0cmluZy5wcm90b3R5cGUuaW5jbHVkZXNcblx0U3RyaW5nOjppbmNsdWRlcyA9IChzZWFyY2gsIHN0YXJ0KSAtPlxuXHRcdCd1c2Ugc3RyaWN0J1xuXHRcdHN0YXJ0ID0gMCBpZiB0eXBlb2Ygc3RhcnQgaXMgJ251bWJlcidcblxuXHRcdGlmIHN0YXJ0ICsgc2VhcmNoLmxlbmd0aCA+IHRoaXMubGVuZ3RoXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0ZWxzZVxuXHRcdFx0cmV0dXJuIEBpbmRleE9mKHNlYXJjaCwgc3RhcnQpIGlzbnQgLTFcblxuIyBFeHBhbmQgbGF5ZXJcblxuTGF5ZXI6Omhvb2sgPSAoY29uZmlnKSAtPlxuXG5cdHRocm93IG5ldyBFcnJvciAnbGF5ZXIuaG9vaygpIG5lZWRzIGEgcHJvcGVydHksIGEgaG9vayB0eXBlIGFuZCBlaXRoZXIgYSB0YXJnZXQgb2JqZWN0IG9yIHRhcmdldCBwcm9wZXJ0eSB0byB3b3JrJyB1bmxlc3MgY29uZmlnLnByb3BlcnR5IGFuZCBjb25maWcudHlwZSBhbmQgKGNvbmZpZy50byBvciBjb25maWcudGFyZ2V0UHJvcGVydHkpXG5cblx0IyBTaW5nbGUgYXJyYXkgZm9yIGFsbCBob29rcywgYXMgb3Bwb3NlZCB0byBuZXN0ZWQgYXJyYXlzIHBlciBwcm9wZXJ0eSwgYmVjYXVzZSBwZXJmb3JtYW5jZVxuXHRAaG9va3MgPz1cblx0XHRob29rczogW11cblx0XHR2ZWxvY2l0aWVzOiB7fVxuXHRcdGRlZnM6XG5cdFx0XHR6b29tOiAxMDBcblx0XHRcdGdldERyYWc6ICh2ZWxvY2l0eSwgZHJhZywgem9vbSkgPT5cblx0XHRcdFx0dmVsb2NpdHkgLz0gem9vbVxuXHRcdFx0XHQjIERpdmlkaW5nIGJ5IDEwIGlzIHVuc2NpZW50aWZpYywgYnV0IGl0IG1lYW5zIGEgdmFsdWUgb2YgMiBlcXVhbHMgcm91Z2hseSBhIDEwMGcgYmFsbCB3aXRoIDE1Y20gcmFkaXVzIGluIGFpclxuXHRcdFx0XHRkcmFnID0gLShkcmFnIC8gMTApICogdmVsb2NpdHkgKiB2ZWxvY2l0eSAqIHZlbG9jaXR5IC8gTWF0aC5hYnModmVsb2NpdHkpXG5cdFx0XHRcdGlmIF8uaXNOYU4oZHJhZykgdGhlbiByZXR1cm4gMCBlbHNlIHJldHVybiBkcmFnXG5cdFx0XHRnZXRHcmF2aXR5OiAoc3RyZW5ndGgsIGRpc3RhbmNlLCB6b29tKSA9PlxuXHRcdFx0XHRkaXN0ID0gTWF0aC5tYXgoMSwgZGlzdGFuY2UgLyB6b29tKVxuXHRcdFx0XHRyZXR1cm4gc3RyZW5ndGggKiB6b29tIC8gKGRpc3QgKiBkaXN0KVxuXG5cdCMgVXBkYXRlIHRoZSB6b29tIHZhbHVlIGlmIGdpdmVuXG5cdEBob29rcy56b29tID0gY29uZmlnLnpvb20gaWYgY29uZmlnLnpvb21cblxuXHQjIFBhcnNlIHBoeXNpY3MgY29uZmlnIHN0cmluZ1xuXHRmID0gVXRpbHMucGFyc2VGdW5jdGlvbiBjb25maWcudHlwZVxuXHRjb25maWcudHlwZSA9IGYubmFtZVxuXHRjb25maWcuc3RyZW5ndGggPSBmLmFyZ3NbMF1cblx0Y29uZmlnLmZyaWN0aW9uID0gZi5hcmdzWzFdIG9yIDBcblxuXHQjIERlZmF1bHQgdG8gc2FtZSB0YXJnZXRQcm9wZXJ0eSBvbiBzYW1lIG9iamVjdCAoaG9wZWZ1bGx5IHlvdSd2ZSBzZXQgYXQgbGVhc3Qgb25lIG9mIHRoZXNlIHRvIHNvbWV0aGluZyBlbHNlKVxuXHRjb25maWcudGFyZ2V0UHJvcGVydHkgPz0gY29uZmlnLnByb3BlcnR5XG5cdGNvbmZpZy50byA/PSBAXG5cblx0IyBBbGwgcG9zaXRpb24gYWNjZWxlcmF0aW9ucyBhcmUgYWRkZWQgdG8gYSBzaW5nbGUgJ3BvcycgdmVsb2NpdHkuIFN0b3JlIGFjdHVhbCBwcm9wZXJ0aWVzIHNvIHdlIGRvbid0IGhhdmUgdG8gZG8gaXQgYWdhaW4gZXZlcnkgZnJhbWVcblxuXHRpZiBjb25maWcucHJvcGVydHkudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyAncG9zJ1xuXHRcdGNvbmZpZy5wcm9wID0gJ3Bvcydcblx0XHRcblx0XHRpZiBjb25maWcucHJvcGVydHkudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyAnbWlkJ1xuXHRcdFx0Y29uZmlnLnRoaXNYID0gJ21pZFgnXG5cdFx0XHRjb25maWcudGhpc1kgPSAnbWlkWSdcblx0XHRcblx0XHRlbHNlIGlmIGNvbmZpZy5wcm9wZXJ0eS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzICdtYXgnXG5cdFx0XHRjb25maWcudGhpc1ggPSAnbWF4WCdcblx0XHRcdGNvbmZpZy50aGlzWSA9ICdtYXhZJ1xuXHRcdFxuXHRcdGVsc2Vcblx0XHRcdGNvbmZpZy50aGlzWCA9ICd4J1xuXHRcdFx0Y29uZmlnLnRoaXNZID0gJ3knXG5cdFx0XG5cdFx0aWYgY29uZmlnLnRhcmdldFByb3BlcnR5LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMgJ21pZCdcblx0XHRcdGNvbmZpZy50b1ggPSAnbWlkWCdcblx0XHRcdGNvbmZpZy50b1kgPSAnbWlkWSdcblx0XHRcblx0XHRlbHNlIGlmIGNvbmZpZy50YXJnZXRQcm9wZXJ0eS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzICdtYXgnXG5cdFx0XHRjb25maWcudG9YID0gJ21heFgnXG5cdFx0XHRjb25maWcudG9ZID0gJ21heFknXHRcdFxuXHRcdGVsc2Vcblx0XHRcdGNvbmZpZy50b1ggPSAneCdcblx0XHRcdGNvbmZpZy50b1kgPSAneSdcblx0XHRcblx0ZWxzZVxuXHRcdGNvbmZpZy5wcm9wID0gY29uZmlnLnByb3BlcnR5XG5cblx0IyBTYXZlIGhvb2sgdG8gQGhvb2tzIGFycmF5XHRcblx0QGhvb2tzLmhvb2tzLnB1c2goY29uZmlnKVxuXG5cdCMgQ3JlYXRlIHZlbG9jaXR5IHByb3BlcnR5IGlmIG5lY2Vzc2FyeVxuXHRAaG9va3MudmVsb2NpdGllc1tjb25maWcucHJvcF0gPz0gaWYgY29uZmlnLnByb3AgaXMgJ3BvcycgdGhlbiB7IHg6IDAsIHk6IDAgfSBlbHNlIDBcblxuXHQjIFVzZSBGcmFtZXIncyBhbmltYXRpb24gbG9vcCwgc2xpZ2h0bHkgbW9yZSByb2J1c3QgdGhhbiByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgZGlyZWN0bHlcblx0RnJhbWVyLkxvb3Aub24gJ3JlbmRlcicsIEBob29rTG9vcCwgdGhpc1xuXG5cblxuTGF5ZXI6OnVuSG9vayA9IChwcm9wZXJ0eSwgb2JqZWN0KSAtPlxuXHRcblx0cmV0dXJuIHVubGVzcyBAaG9va3NcblxuXHRwcm9wID0gaWYgcHJvcGVydHkudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyAncG9zJyB0aGVuICdwb3MnIGVsc2UgcHJvcGVydHlcblxuXHQjIFJlbW92ZSBhbGwgbWF0Y2hlc1xuXHRAaG9va3MuaG9va3MgPSBAaG9va3MuaG9va3MuZmlsdGVyIChob29rKSAtPlxuXHRcdGhvb2sudG8gaXNudCBvYmplY3Qgb3IgaG9vay5wcm9wZXJ0eSBpc250IHByb3BlcnR5XG5cblx0IyBJZiB0aGVyZSBhcmUgbm8gaG9va3MgbGVmdCwgc2h1dCBpdCBkb3duXG5cdGlmIEBob29rcy5ob29rcy5sZW5ndGggaXMgMFxuXHRcdGRlbGV0ZSBAaG9va3Ncblx0XHRGcmFtZXIuTG9vcC5yZW1vdmVMaXN0ZW5lciAncmVuZGVyJywgQGhvb2tMb29wXG5cdFx0cmV0dXJuXG5cblx0IyBTdGlsbCBoZXJlPyBDaGVjayBpZiB0aGVyZSBhcmUgYW55IHJlbWFpbmluZyBob29rcyBhZmZlY3Rpbmcgc2FtZSB2ZWxvY2l0eVxuXHRyZW1haW5pbmcgPSBAaG9va3MuaG9va3MuZmlsdGVyIChob29rKSAtPlxuXHRcdHByb3AgaXMgaG9vay5wcm9wXG5cdFx0XG5cdCMgSWYgbm90LCBkZWxldGUgdmVsb2NpdHkgKG90aGVyd2lzZSBpdCB3b24ndCBiZSByZXNldCBpZiB5b3UgbWFrZSBuZXcgaG9vayBmb3Igc2FtZSBwcm9wZXJ0eSlcblx0ZGVsZXRlIEBob29rcy52ZWxvY2l0aWVzW3Byb3BdIGlmIHJlbWFpbmluZy5sZW5ndGggaXMgMFxuXG5MYXllcjo6aG9va0xvb3AgPSAoZGVsdGEpIC0+XG5cblx0aWYgQGhvb2tzXG5cblx0XHQjIE11bHRpcGxlIGhvb2tzIGNhbiBhZmZlY3QgdGhlIHNhbWUgcHJvcGVydHkuIEFkZCBhY2NlbGVyYXRpb25zIHRvIHRlbXBvcmFyeSBvYmplY3Qgc28gdGhlIHByb3BlcnR5J3MgdmVsb2NpdHkgaXMgdGhlIHNhbWUgZm9yIGFsbCBjYWxjdWxhdGlvbnMgd2l0aGluIHRoZSBzYW1lIGFuaW1hdGlvbiBmcmFtZVxuXHRcdGFjY2VsZXJhdGlvbiA9IHt9XG5cdFx0XG5cdFx0IyBTYXZlIGRyYWcgZm9yIGVhY2ggcHJvcGVydHkgdG8gdGhpcyBvYmplY3QsIHNpbmNlIG9ubHkgbW9zdCByZWNlbnRseSBzcGVjaWZpZWQgdmFsdWUgaXMgdXNlZCBmb3IgZWFjaCBwcm9wZXJ0eVxuXHRcdGRyYWcgPSB7fVxuXHRcdFxuXHRcdCMgQWRkIGFjY2VsZXJhdGlvbnNcblx0XHRmb3IgaG9vayBpbiBAaG9va3MuaG9va3Ncblx0XHRcblx0XHRcdGlmIGhvb2sucHJvcCBpcyAncG9zJ1xuXG5cdFx0XHRcdGFjY2VsZXJhdGlvbi5wb3MgPz0geyB4OiAwLCB5OiAwIH1cblxuXHRcdFx0XHR0YXJnZXQgPSB7IHg6IGhvb2sudG9baG9vay50b1hdLCB5OiBob29rLnRvW2hvb2sudG9ZXSB9XG5cblx0XHRcdFx0dGFyZ2V0ID0gaG9vay5tb2R1bGF0b3IodGFyZ2V0KSBpZiBob29rLm1vZHVsYXRvclxuXG5cdFx0XHRcdHZlY3RvciA9XG5cdFx0XHRcdFx0eDogdGFyZ2V0LnggLSBAW2hvb2sudGhpc1hdXG5cdFx0XHRcdFx0eTogdGFyZ2V0LnkgLSBAW2hvb2sudGhpc1ldXG5cdFx0XHRcdFxuXHRcdFx0XHR2TGVuZ3RoID0gTWF0aC5zcXJ0KCh2ZWN0b3IueCAqIHZlY3Rvci54KSArICh2ZWN0b3IueSAqIHZlY3Rvci55KSlcblxuXHRcdFx0XHRpZiBob29rLnR5cGUgaXMgJ3NwcmluZydcblxuXHRcdFx0XHRcdGRhbXBlciA9XG5cdFx0XHRcdFx0XHR4OiAtaG9vay5mcmljdGlvbiAqIEBob29rcy52ZWxvY2l0aWVzLnBvcy54XG5cdFx0XHRcdFx0XHR5OiAtaG9vay5mcmljdGlvbiAqIEBob29rcy52ZWxvY2l0aWVzLnBvcy55XG5cblx0XHRcdFx0XHR2ZWN0b3IueCAqPSBob29rLnN0cmVuZ3RoXG5cdFx0XHRcdFx0dmVjdG9yLnkgKj0gaG9vay5zdHJlbmd0aFxuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdGFjY2VsZXJhdGlvbi5wb3MueCArPSAodmVjdG9yLnggKyBkYW1wZXIueCkgKiBkZWx0YVxuXHRcdFx0XHRcdGFjY2VsZXJhdGlvbi5wb3MueSArPSAodmVjdG9yLnkgKyBkYW1wZXIueSkgKiBkZWx0YVxuXHRcdFx0XHRcblx0XHRcdFx0ZWxzZSBpZiBob29rLnR5cGUgaXMgJ2dyYXZpdHknXG5cdFx0XHRcdFxuXHRcdFx0XHRcdGRyYWcucG9zID0gaG9vay5mcmljdGlvblxuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdGdyYXZpdHkgPSBAaG9va3MuZGVmcy5nZXRHcmF2aXR5KGhvb2suc3RyZW5ndGgsIHZMZW5ndGgsIEBob29rcy5kZWZzLnpvb20pXG5cblx0XHRcdFx0XHR2ZWN0b3IueCAqPSBncmF2aXR5IC8gdkxlbmd0aFxuXHRcdFx0XHRcdHZlY3Rvci55ICo9IGdyYXZpdHkgLyB2TGVuZ3RoXG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0YWNjZWxlcmF0aW9uLnBvcy54ICs9IHZlY3Rvci54ICogZGVsdGFcblx0XHRcdFx0XHRhY2NlbGVyYXRpb24ucG9zLnkgKz0gdmVjdG9yLnkgKiBkZWx0YVxuXHRcdFx0XHRcdFx0XHRcdFx0XG5cdFx0XHRlbHNlXG5cdFx0XHRcdFxuXHRcdFx0XHRhY2NlbGVyYXRpb25baG9vay5wcm9wXSA/PSAwXG5cblx0XHRcdFx0dGFyZ2V0ID0gaG9vay50b1tob29rLnRhcmdldFByb3BlcnR5XVxuXG5cdFx0XHRcdHRhcmdldCA9IGhvb2subW9kdWxhdG9yKHRhcmdldCkgaWYgaG9vay5tb2R1bGF0b3JcblxuXHRcdFx0XHR2ZWN0b3IgPSB0YXJnZXQgLSBAW2hvb2sucHJvcF1cblx0XHRcdFx0XG5cdFx0XHRcdGlmIGhvb2sudHlwZSBpcyAnc3ByaW5nJ1xuXG5cdFx0XHRcdFx0Zm9yY2UgPSB2ZWN0b3IgKiBob29rLnN0cmVuZ3RoXG5cdFx0XHRcdFx0ZGFtcGVyID0gLWhvb2suZnJpY3Rpb24gKiBAaG9va3MudmVsb2NpdGllc1tob29rLnByb3BdXG5cblx0XHRcdFx0XHRhY2NlbGVyYXRpb25baG9vay5wcm9wXSArPSAoZm9yY2UgKyBkYW1wZXIpICogZGVsdGFcblxuXHRcdFx0XHRcblx0XHRcdFx0ZWxzZSBpZiBob29rLnR5cGUgaXMgJ2dyYXZpdHknXG5cdFxuXHRcdFx0XHRcdGRyYWdbaG9vay5wcm9wXSA9IGhvb2suZnJpY3Rpb25cblx0XHRcdFx0XHRcblx0XHRcdFx0XHRmb3JjZSA9IEBob29rcy5kZWZzLmdldEdyYXZpdHkoaG9vay5zdHJlbmd0aCwgdmVjdG9yLCBAaG9va3MuZGVmcy56b29tKVxuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdGFjY2VsZXJhdGlvbltob29rLnByb3BdICs9IGZvcmNlICogZGVsdGFcblx0XHRcblx0XHRcblx0XHQjIEFkZCB2ZWxvY2l0aWVzIHRvIHByb3BlcnRpZXMuIERvaW5nIHRoaXMgYXQgdGhlIGVuZCBpbiBjYXNlIHRoZXJlIGFyZSBtdWx0aXBsZSBob29rcyBhZmZlY3RpbmcgdGhlIHNhbWUgdmVsb2NpdHlcblx0XHRmb3IgcHJvcCwgdmVsb2NpdHkgb2YgQGhvb2tzLnZlbG9jaXRpZXNcblx0XHRcblx0XHRcdGlmIHByb3AgaXMgJ3BvcydcblxuXHRcdFx0XHQjIEFkZCBkcmFnLCBpZiBpdCBleGlzdHNcblx0XHRcdFx0aWYgZHJhZy5wb3Ncblx0XHRcdFx0XHR2ZWxvY2l0eS54ICs9IEBob29rcy5kZWZzLmdldERyYWcodmVsb2NpdHkueCwgZHJhZy5wb3MsIEBob29rcy5kZWZzLnpvb20pXG5cdFx0XHRcdFx0dmVsb2NpdHkueSArPSBAaG9va3MuZGVmcy5nZXREcmFnKHZlbG9jaXR5LnksIGRyYWcucG9zLCBAaG9va3MuZGVmcy56b29tKVxuXHRcdFx0XHRcdFxuXHRcdFx0XHQjIEFkZCBhY2NlbGVyYXRpb24gdG8gdmVsb2NpdHlcblx0XHRcdFx0dmVsb2NpdHkueCArPSBhY2NlbGVyYXRpb24ucG9zLnhcblx0XHRcdFx0dmVsb2NpdHkueSArPSBhY2NlbGVyYXRpb24ucG9zLnlcblx0XHRcdFx0XG5cdFx0XHRcdCMgQWRkIHZlbG9jaXR5IHRvIHBvc2l0aW9uXG5cdFx0XHRcdEB4ICs9IHZlbG9jaXR5LnggKiBkZWx0YVxuXHRcdFx0XHRAeSArPSB2ZWxvY2l0eS55ICogZGVsdGFcblx0XHRcdFxuXHRcdFx0ZWxzZVxuXHRcdFx0XG5cdFx0XHRcdCMgQWRkIGRyYWcsIGlmIGl0IGV4aXN0c1xuXHRcdFx0XHRpZiBkcmFnW3Byb3BdXG5cdFx0XHRcdFx0QGhvb2tzLnZlbG9jaXRpZXNbcHJvcF0gKz0gQGhvb2tzLmRlZnMuZ2V0RHJhZyhAaG9va3MudmVsb2NpdGllc1twcm9wXSwgZHJhZ1twcm9wXSwgQGhvb2tzLmRlZnMuem9vbSlcblx0XHRcdFx0XG5cdFx0XHRcdCMgQWRkIGFjY2VsZXJhdGlvbiB0byB2ZWxvY2l0eVxuXHRcdFx0XHRAaG9va3MudmVsb2NpdGllc1twcm9wXSArPSBhY2NlbGVyYXRpb25bcHJvcF1cblx0XHRcdFx0XG5cdFx0XHRcdCMgQWRkIHZlbG9jaXR5IHRvIHByb3BlcnR5XG5cdFx0XHRcdEBbcHJvcF0gKz0gQGhvb2tzLnZlbG9jaXRpZXNbcHJvcF0gKiBkZWx0YVxuXG5cdFx0QG9uSG9va1VwZGF0ZT8oZGVsdGEpIl19
