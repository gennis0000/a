let filter_switch = true
let filter_only_list = true

chrome.commands.onCommand.addListener(
    command => {
        switch (command) {
            case 'filter-switch':
                if (filter_switch === true){
                    filter_switch = false
                }else{
                    filter_switch = true
                }
            case "filter-only-list":
                if (filter_only_list === true){
                    filter_only_list = false
                }else{
                    filter_only_list = true
                }
        }
    }
)

// 黑名单和白名单
function DChecker(l){
    this.domain_list = l
}

DChecker.prototype.Check = function (domain) {
    for (i in this.domain_list){
        let d = this.domain_list[i]
        if (domain.indexOf(d) >= 0){ // 判断名单中的值是否是要检查的域名的一部分(或完全匹配)
            if( domain.indexOf(d) === domain.length-d.length){
                return true
            }
        }
    }
    return false
}

let wl = new DChecker(["www.baidu.com"])

let bl = new DChecker(["cnzz.com","tagtic.cn","mmstat.com","anquan.org","baidu.com","baidustatic.com",
"bdstatic.com","tanx.com","pstatp.com","google-analytics.com","googlesyndication.com",
"googleadservices.com","doubleclick.net","growingio.com","dlads.cn"])

// domain
function Domain(str){
    this.valid = false
    if (str === undefined){
        return
    }
    if (str.length <= 8){
        return
    }

    let isHttp = false
    if (str.substr(0,8) === "https://"){
        isHttp = true
        this.proto = "https"
    } else if (str.substr(0,7) === "http://"){
        isHttp = true
        this.proto = "http"
    }
    if (isHttp !== true){
        return
    }

    let splited = str.split("/")
    if (splited.length < 3){
        return
    }
    this.domain = splited[2]

    this.url = str

    this.path = ""
    this.query = ""
    if (splited.length > 3){
        this.uriPath = splited.slice(3,splited.length).join("/")
        let psplit = this.uriPath.split("?")
        if (psplit.length === 2){
            this.path = psplit[0]
            this.query = psplit[1]
        } else{
            this.path = psplit[0]
            this.query = ""
        }
    }

    this.fType = ""
    let ts = this.path.split(".")
    if (ts.length > 1){
        this.fType = ts[ts.length-1]
    }

    this.valid = true
    return
}

Domain.prototype.GetDomain = function (num){
    // 为了应对两级都是通用域名的情况,假定只有最后一级是同网站的不同子域名
    let s = this.domain.split(".")
    if (num === undefined){
        if (s.length < 2){
            console.log("invalid domain")
            console.log(this.domain)
            return
        } else if (s.length < 4){
            num = 2
        } else{
            num = s.length - 1
        }
    }

    if (s.length < num){
        return this.domain
    }

    s = s.reverse()
    let ret = s.slice(0,num).join(".")
    return ret
}

Domain.prototype.ContentType = function (type) {
    if (this.fType === type){
        return true
    }
    return false
}

//
// listener
//

chrome.webRequest.onBeforeSendHeaders.addListener(
    function (detail){
        if (filter_switch === true){
            return js_blocker(detail, "js")
        }
    },
    { urls: ["<all_urls>"] },
    ["blocking", "extraHeaders", "requestHeaders"]
)

chrome.webRequest.onHeadersReceived.addListener(
    function (detail){
        if (filter_switch === true){
            if (detail.type === "script"){
                console.log(detail.url)
                console.log(detail.type)
                return js_blocker(detail, "script")
            }
        }
    },
    { urls: ["<all_urls>"] },
    ["blocking", "extraHeaders", "responseHeaders"]
)


function js_blocker(detail, type){
    // 检查目标域名
    let td = new Domain(detail.url)
    if (td.valid === false){
        console.log("detail url is: "+detail.url)
        return
    }
    // 检查黑名单和白名单，先白名单
    if (wl.Check(td.domain) == true){
        console.log("wl:"+td.domain)
        return
    }
    if (bl.Check(td.domain) == true){
        console.log("bl:"+td.domain)
        return {cancel: true}
    }

    // 获得发起者域名
    let cd = new Domain(detail.initiator)
    if (cd.valid === false){
        let referer = ""
        for (i in detail.requestHeaders){
            if (detail.requestHeaders[i]["name"] === "Referer"){
                referer = detail.requestHeaders[i]["value"]
            }
        }
        if (referer === ""){
            console.log("no referer")
            console.log("initiator:" + detail.initiator)
            console.log("header is: ")
            console.log(detail.requestHeaders)
            return
        }

        // 根据referer检查请求发起者域名
        cd = new Domain(referer);
        if (cd.valid === false){
            console.log("referer is: "+referer)
            console.log("header is: ")
            console.log(detail.requestHeaders)
            console.log("initiator:" + detail.initiator)
            return
        }
    }

    // 检查白名单，如果在则直接放行
    if (wl.Check(cd.domain) == true){
        console.log("wl:"+cd.domain)
        return
    }

    // switch only list 控制是否只检查黑白名单
    if (filter_only_list === true){
        return
    }

    // 是否进行母域名检查
    let ck = false
    if (type === "js"){
        if (td.ContentType("js") === true){
            ck = true
        }
    }
    if (type === "script"){
        ck = true
    }

    // check
    if (ck === true){
        if (cd.GetDomain() === td.GetDomain()){
            console.log("type: "+type)
            console.log("pass: "+cd.url+"   "+td.url)
            return
        }
        console.log("type: "+type)
        console.log("block: "+td.url)
        return {cancel: true}
    }
    console.log("type: "+type)
    console.log("skip: "+td.url)
}


