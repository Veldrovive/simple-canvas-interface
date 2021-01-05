const axios = require('axios')
const parseLinks = require('parse-link-header')

// Why is this done with a class? I like oop... thats kinda it.
class Requester {
    constructor (accessToken, subdomain = 'utoronto', params) {
        ({
            debounceTime: this.debounceTime = 200,
            defaultPageLength: this.defaultPageLength = 10,
            debug: this.debug = false
        } = params)
        this.accessToken = accessToken
        this.subdomain = subdomain
        this.baseURL = `https://${this.subdomain}.instructure.com`

        this.axiosInstance = axios.create({
            baseURL: this.baseURL,
            headers: { 'Authorization': `Bearer ${this.accessToken}` }
        })

        this.retryStatusCodes = [403]
        this.successStatusCodes = [200]
    }

    log (...message) {
        if (this.debug) {
            console.log(...message)
        }
    }

    spawnRequest (endpoint, params) {
        /**
         * Sends a request to the server. If the request is throttled, it will retry the request in this.denounceTime milliseconds.
         * If the server responds there there are more pages, those will be requested and concatenated.
         * If the request succedes, the resolved object will be the response body.
         * If the request fails, the rejected object will be { statusCode: STATUS, reason: MESSAGE_STRING }
         */
        if (!endpoint.includes('per_page')) {
            params = params || {}
            params['per_page'] = this.defaultPageLength
        }
        if (endpoint.substring(0, this.baseURL.length) === this.baseURL) {
            // Checks if the baseurl is already prepended to the endpoint.
            // This is for users who do this, but also because the link header includes these and we want to request to those without any fuss.
            endpoint = endpoint.substring(this.baseURL.length)
        }
        if (endpoint.charAt(0) !== '/') {
            // Makes sure that the correct domain is hit.
            endpoint = '/' + endpoint
        }
        if (params) {
            // Params must be in the format: { paramKey: paramValue } where paramValue may be an array or primative.
            // If params are passed, we convert them to a query string and append it to the request.
            // We assume that if the user has already used a query string there will be a ? in the request and the query string is at the end
            const initialChar = endpoint.includes('?') ? '&' : '?'
            let queryString = ''
            let isFirst = true
            for (const [ paramKey, paramValue ] of Object.entries(params)) {
                if (Array.isArray(paramValue)) {
                    for (const paramSubValue of paramValue) {
                        const newTerm = `${isFirst ? '' : '&'}${paramKey}[]=${paramSubValue}`
                        queryString += newTerm
                        isFirst = false
                    }
                } else {
                    const newTerm = `${isFirst ? '' : '&'}${paramKey}=${paramValue}`
                    queryString += newTerm
                    isFirst = false
                }
            }
            endpoint += `${initialChar}${queryString}`
        }
        this.log('Getting endpoint:', endpoint)
        return new Promise((resolve, reject) => {
            const attemptRequest = async () => {
                // Tries to get the data. Will retry itself if the rate is limited. If another error is returned, it will throw with the above format.
                try {
                    const res = await this.axiosInstance.get(endpoint)
                    if (this.successStatusCodes.includes(res.status)) {
                        let body = res.data
                        const linkHeader = res.headers.link
                        const parsedLinks = parseLinks(linkHeader)
                        if ('next' in parsedLinks) {
                            const nextPageEndpoint = parsedLinks['next'].url
                            // We recursively call this same function for getting more pages until the base condition of there being no next page
                            const followingPagesContents = await this.spawnRequest(nextPageEndpoint)
                            try {
                                // Body should be an array if there are pages so this should be a safe operation.
                                body  = [...body, ...followingPagesContents]
                            } catch (err) {
                                console.error('Failed to concatenate next page onto previous. Did the last request not return an array?', err)
                            }
                        }
                        resolve(body)
                    } else if (this.retryStatusCodes.includes(res.status)) {
                        // Then we retry the request after a bit
                        setTimeout(attemptRequest.bind(this), this.debounceTime)
                    } else {
                        // Then this request failed and should not be retried.
                        reject({ statusCode: res.status, reason: res.statusText })
                    }
                } catch (err) {
                    // If a subcall for more pages fails, this will set the exception behavior correctly
                    reject(err)
                }
            }
            attemptRequest()
        })
    }
}

function createCanvasInterface(accessToken, subdomain, debug=false) {
    /**
     * Gets a function that pings the canvas api with the correct authorization and throttling.
     */
    subdomain = subdomain
    const requester = new Requester(accessToken, subdomain, { debug, defaultPageLength: 100 })
    return requester.spawnRequest.bind(requester)
}

module.exports = createCanvasInterface