# Simple Canvas Interface
I found many npm packages that purported to handle the canvas api. Unfortunately, they all had the sample problem of only being built to handle one api key whereas I wanted to handle many concurently without having to worry about rate limiting.

They also had many more features than I was looking for. I just wanted to be able to choose an endpoint, supply query string parameters, and get the response without needing to handle throttling or pagination.

**When to use this module**: When you want to send requests on behalf of many different students to your school's canvas given an endpoint. If you just want to use one access token or want high level functionality, there are many other other modules that do that better.

## Usage:
Install the modules: `npm install simple-canvas-interface`

Import the module:
```js
// .js file
const createCanvasInterface = require('simple-canvas-interface')

// .mjs file
import createCanvasInterface from 'simple-canvas-interface'
```
The `createCanvasInterface` is a function that takes the parameters:
1. `accessToken`: The student's access token. This should be aquired the OAuth in production.
2. `subdomain`: Your school's canvas subdomain.
3. `params`: An object to set the options. They are - 
   * `debounceTime`: If the throttle limit is reached, the request will be retried after `debounceTime` milliseconds. The default is `200`.
   * `defaultPageLength`: For paginated endpoints, each request will request `defaultPageLength` pages. A higher number here will increase the wait time for each request, but decrease the number of calls made to get all data. The default is `100`.
   * `debug`: If this is `true` a small amount of debug information will be printed.

The return value is a function that can be called with an `endpoint` and `query string` object which will send a request with throttling and pagination.

**Note**: The query string object will accept primative types and arrays.

### Example 
```js
// Import the module
const createCanvasInterface = require('simple-canvas-interface')

const subdomain = YOUR_SUBDOMAIN

async function getActiveCourses (accessToken) {
  // We create a requester that will retry requests after 1 second and will get 10 pages in each request.
  const requester = createCanvasInterface(accessToken, subdomain, { debounceTime: 1000, defaultPageLength: 10 })
  
  // We want to request all active courses and get the names of the teachers in each course
  const courses = await requester('/api/v1/courses', {
    include: ['teachers'],
    enrollment_state: 'active'
  })
  // This will format the endpoint as /api/v1/courses?include[]=teachers&per_page=10 and then concatenate all pages while avoiding throttling.
  
  return courses
}

getActiveCourses(YOUR_ACCESS_TOKEN)
  .then(courses => {
    console.log('Courses', courses)
  })
```
