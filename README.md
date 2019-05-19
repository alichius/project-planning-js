Algorithm for project planning. More precisely, *list scheduling* with support for machines running at different speeds, optional preemption, optional splitting of jobs across machines, release dates, and delivery times.

## Status

[![Build Status](https://travis-ci.org/fschopp/project-planning-js.svg?branch=master)](https://travis-ci.org/fschopp/project-planning-js)
[![Coverage Status](https://coveralls.io/repos/github/fschopp/project-planning-js/badge.svg?branch=master)](https://coveralls.io/github/fschopp/project-planning-js?branch=master)
[![npm](https://img.shields.io/npm/v/@fschopp/project-planning-js.svg)](https://www.npmjs.com/package/@fschopp/project-planning-js)

## Overview

- Transforms input of the following form
  ```json
  {
    "machineSpeeds": [40, 8, 15],
    "jobs": [
      {"size": 240, "preAssignment": 1, "releaseTime": 40, "splitting": "none"},
      {"size": 640, "preAssignment": 1, "splitting": "preemption"},
      {"size": 3200, "splitting": "multi", "dependencies": [3]},
      {"size": 3200, "deliveryTime": 20, "splitting": "multi", "preAssignment": 2}
    ],
    "minFragmentSize": 320
  }
  ```
  into a project plan that could be visualized as follows:
  
  ![Project Plan](https://raw.github.com/fschopp/project-planning-js/master/.readme-img/schedule.svg?sanitize=true)
- See the [interactive demo](https://fschopp.github.io/project-planning-js/) for experimenting with the algorithm, including visualizing its output as shown above.
- No dependencies.
- Written in TypeScript, but easily usable from JavaScript.
- Tests have [full code coverage](https://fschopp.github.io/project-planning-js/coverage/).

## License

[Apache License 2.0](LICENSE)

## Releases and Usage

Published releases include TypeScript type declarations and are available as either [UMD](https://github.com/umdjs/umd) or ECMAScript 2015 (aka ES6) modules.

### Node.js

Install with `npm install @fschopp/project-planning-js` or `yarn add @fschopp/project-planning-js`. Use the package as follows (example is in TypeScript, but ES6 JavaScript essentially reads the same, minus the types):
```typescript
import {
  computeSchedule,
  Schedule,
  SchedulingFailure,
  SchedulingInstance,
} from '@fschopp/project-planning-js';
const instance: SchedulingInstance = {
  machineSpeeds: [ /* ... */ ],
  jobs: [ /* ... */ ]
};
const schedule: Schedule | SchedulingFailure = computeSchedule(instance);
```

### Browser

Include the minified sources from the [jsDelivr CDN](https://www.jsdelivr.com/package/npm/@fschopp/project-planning-js):
```html
<script src="https://cdn.jsdelivr.net/npm/@fschopp/project-planning-js@.../dist/index.min.js"
  integrity="..." crossorigin="anonymous"></script>
```
Of course, the two occurrences of `...` need to be replaced by the current version and its corresponding [subresource integrity (SRI)](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity) hash. Then, in a subsequent script:
```javascript
let instance = { /* as above */ };
let schedule = ProjectPlanningJs.computeSchedule(instance);
// Or compute in a separate thread (using a web worker):
let promise = ProjectPlanningJs.computeScheduleAsync(instance);
```

See [JSFiddle](https://jsfiddle.net/fschopp/3Lus0h7e/) for an example.


## Project Documentation

- [API documentation](https://fschopp.github.io/project-planning-js/doc/) generated by TypeDoc.


## Build

- See the git history to find out the versions of the following development dependencies that were in use at the time of writing.
- The source code is exclusively written in TypeScript. The TypeScript compiler compiles the source code into ECMAScript 2015 (aka ES6) modules, with a target of ECMAScript 2017. Its output is not yet ready for distribution because newer ECMAScript language features may not yet be widely supported by web browsers or Node.js. Additionally, the output by the TypeScript compiler still contains assertions. Creating the distribution therefore relies on another compilation step with [Babel](https://babeljs.io). Additionally, we also create a minified build.
- We use [Rollup](https://rollupjs.org) for creating the distribution; that is, the final compilation and assembly. The distribution exists in 3 different forms:
  1. A single-file [UMD](https://github.com/umdjs/umd) module (at `dist/index.js`) that is “capable of working everywhere, be it in the client, on the server or elsewhere.” This is what the `main` property in the [package.json](package.json) file references.
  2. Same as the previous, but minified.
  3. An ES6 module with the same file layout as in the source tree. The only further transformation on the output from the TypeScript compiler is stripping of assertions. The ES6 distribution resides under `dist/es6`. This is what the `module` property in the [package.json](package.json) file references.
- Rollup invokes Babel indirectly, through the [rollup-plugin-babel](https://github.com/rollup/rollup-plugin-babel).
- Unfortunately, rollup-plugin-babel does not pick up the [src/main/.babelrc.js](src/main/.babelrc.js) file. This leads to a little bit of redundant configuration in [rollup.config.js](rollup.config.js).
- Parcel, which is used during development and for bundling the demo site, does consider the [src/main/.babelrc.js](src/main/.babelrc.js) file, however. (It does not care about the Rollup configuration.) It [uses Babel to transpile ES6 JavaScript by default](https://parceljs.org/javascript.html#default-babel-transforms), without any (additional) configuration.
- Both rollup-plugin-babel and Parcel consider the `browserslist` field in file `package.json`: rollup-plugin-babel [delegates entirely to package @babel/preset-env](https://github.com/rollup/rollup-plugin-babel/issues/206) (which then [is mindful of that setting](https://babeljs.io/docs/en/babel-preset-env#browserslist-integration)), and [Parcel looks for the field, too](https://github.com/parcel-bundler/parcel/blob/parcel-bundler%401.12.3/packages/core/parcel-bundler/src/utils/getTargetEngines.js#L10-L40).
- The distribution has [source maps](https://developer.mozilla.org/en-US/docs/Tools/Debugger/How_to/Use_a_source_map) that link the final JavaScript to its TypeScript sources. The configuration ensures that source maps of consecutive transformations are correctly merged.


## Algorithm Description

### Overview

This module implements a generalized *list scheduling* algorithm, a notion first formalized by [Graham (1966)][Graham_1966]. The algorithm is given a priority list of jobs, and “at each step the available job with the highest ranking [...] is assigned to the first machine that becomes available” ([Graham et al., 1979][Graham_et_al_1979]).
 
Our extensions are very common in the literature; see [Lawler et al. (1993)][Lawler_et_al_1993].
1. Machines are *uniform* (also called *related*). That is, each machine has a speed *s*<sub><i>i</i></sub> so that the processing time of a job on a particular machine is inversely proportional to that machine’s speed.
2. Each job may optionally be interrupted (known as *preemption*).
3. Each job may optionally be processed by more than one machine at a time, as long as the processing requirement of each job fragment is not less than a given threshold. (If a job allows splitting across machines, this also includes allowing preemption.)
4. There is a *release date* <i>r</i><sub><i>j</i></sub> for each job; that is, an earliest start time.
5. There is a *delivery time* <i>q</i><sub><i>j</i></sub> for each job that must elapse between the end of the job’s processing and the start of any dependent job.
6. As part of the input, each job may already be assigned to a particular machine.

In the three-field notation for theoretical scheduling problems introduced by [Graham et al. (1979)][Graham_et_al_1979], this algorithm is applicable to a superset of Q│prec,<i>r</i><sub><i>j</i></sub>,<i>q</i><sub><i>j</i></sub>│<i>γ</i>. The reasons for “superset” are:
- Item 2 allows preemption as a job-specific option (as opposed to preemption being allowed or disallowed for all jobs).
- Items 3 and 6 above.

A typical optimization goal is <i>γ</i> = <i>C</i><sub>max</sub>; that is, minimizing the maximum completion time, also known as the *makespan*. However, the list scheduling algorithm is obviously independent of the optimization goal (it is the approximation ratio that is not!).

### Details and Runtime

- List scheduling is a greedy algorithm.
- Let <i>m</i> be the number of machines, and <i>n</i> the number of jobs. The algorithm repeats the following steps for each job:
  - Among all remaining available jobs, determine the one that came first on the input list. This requires extracting the minimum from a heap and takes time O(log <i>n</i>).
  - Scheduling a single job takes time O(<i>n</i> + <i>m</i>):
    - If the job can be split across machines, fill the gaps following the release time. At any time a machine becomes available or unavailable, update the current total speed. The number of gaps on all machines (or equivalently, the number of update steps) is O(<i>n</i>).
    - If the job cannot be split across multiple machines, find the machine which would allow the earliest completion of the job. In aggregate, for all machines, this again may require iterating over O(<i>n</i>) gaps.
- The total worst-case runtime is thus O(<i>n</i><sup>2</sup> + <i>n</i> · <i>m</i>). However, assuming that only few gaps will arise in the schedule (for instance, because there are few dependencies, most jobs have no release times, or there are frequently splittable jobs that will fill up the gaps), the run time should be closer to O(<i>n</i> · (<i>m</i> + log <i>n</i>)).
- In any case, the runtime should rarely be a problem for any scheduling task that one would reasonably want to solve in a web browser.

### Approximation Guarantees

- Even the most simple discrete scheduling problems are NP-hard. This includes, for instance, minimizing the makespan on two identical machines (P2││<i>C</i><sub>max</sub> in short).
- Worse, in particular when precedence constraints are added, the theoretical understanding of scheduling problems is still limited. For instance, no constant-factor approximation algorithm is known at all for makespan minimization on uniform machines (Q│prec│<i>C</i><sub>max</sub>), and this of course also applies to list scheduling. See [Chekuri and Bender (2001)][Chekuri_and_Bender_2001].
- In practice, however, list scheduling is known to perform quite well for natural scheduling problems.
- On identical machines (all speeds are the same), the list scheduling algorithm performs reasonably well even with precedence constraints. The approximation ratio for makespan minimization in this case (P│prec│<i>C</i><sub>max</sub>) is 2 – (1 / <i>m</i>). See [Graham (1966)][Graham_1966].
- [Liu and Liu (1974)][Liu_and_Liu_1974] showed that the approximation guarantee for list scheduling on uniform machines becomes much worse: 1 + max <i>s</i><sub><i>i</i></sub> / min <i>s</i><sub><i>i</i></sub> – max <i>s</i><sub><i>i</i></sub> / ∑ <i>s</i><sub><i>i</i></sub>.


## References

- Chekuri and Bender (2001): “[An Efficient Approximation Algorithm for Minimizing Makespan on Uniformly Related Machines][Chekuri_and_Bender_2001].”
- Graham (1966): “[Bounds for Certain Multiprocessing Anomalies][Graham_1966].”
- Graham, Lawler, Lenstra, Rinnooy Kan (1979): “[Optimization and Approximation in Deterministic Sequencing and Scheduling: a Survey][Graham_et_al_1979].”
- Lawler, Lenstra, Rinnooy Kan, Shmoys (1993): “[Sequencing and scheduling: Algorithms and complexity][Lawler_et_al_1993]”
- Liu and Liu (1974): “[Bounds on scheduling algorithms for heterogeneous computing systems][Liu_and_Liu_1974],” Technical Report UIUCDCS-R-74-632, Department of Computer Science, University of Illinois at Urbana-Champaign. 

[Chekuri_and_Bender_2001]: https://dx.doi.org/10.1006/jagm.2001.1184
[Graham_1966]: https://dx.doi.org/10.1002/j.1538-7305.1966.tb01709.x
[Graham_et_al_1979]: https://dx.doi.org/10.1016/S0167-5060(08)70356-X
[Lawler_et_al_1993]: https://dx.doi.org/10.1016/S0927-0507(05)80189-6
[Liu_and_Liu_1974]: https://archive.org/details/boundsonscheduli632liuj
