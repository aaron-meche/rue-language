// 
//  Rue Language Compiler
// 
//  created by Aaron Meche
//  for Rue the Dachshund
// 


import path from 'path'
import fs from 'fs'


// Main Compiler Class
export class View {
    DOM = null              // Final DOM Object
    srcDir = null           // Local Directory
    rawStr = ""             // Raw Unprocessed Code
    rawStrSplit = []        // Main Code Array
    currentLineIndex = 0    // Index of rawLineSplit
    lineOffset = 0          // Counter for Special Instances
    customStructs = {}      // Custom Structure Library
    head = []               // HTML Head
    endHtml = []            // HTML Suffix
    html = []               // HTML Body
    js = []                 // Javascript Array
    css = []                // CSS Array


    // Takes in file content, callback for DOM, and directory for file access
    constructor(txt, callback, directory) {
        this.rawStr = txt
        this.srcDir = directory ? directory : null
        this.compile(DOM => {
            if (callback) callback(DOM)
            this.DOM = DOM
        })
    }


    // Splits raw code and processes each line
    compile(callback) {
        this.rawStrSplit = this.rawStr.split("\n")

        for (let i = 0; i < this.rawStrSplit.length + this.lineOffset; i++) {
            let currentLine = this.rawStrSplit[this.currentLineIndex]
            if (currentLine == undefined) break
            this.processLine(currentLine)
            this.currentLineIndex++
        }

        callback({
            head: this.head.join("\n"), 
            html: this.html.join("\n"), 
            endHtml: this.endHtml.join("\n"),
            js: this.js.join("\n"),
            css: this.css.join("\n"), 
        })
    }

    // Compute code by line
    processLine(line) {
        line = line.toString()?.trim()
        let lineSplit = line?.split(" ")
        let firstKey = lineSplit[0]?.trim()
        let secondKey = lineSplit[1]?.trim()
        let thirdKey = lineSplit[2]?.trim()

        // Custom Javascript
        if (firstKey == "{") {
            let contents = []
            let ignoreLineCount = 0
            for (let i = this.currentLineIndex + 1; i < this.rawStrSplit.length; i++) {
                ignoreLineCount++
                let line = this.rawStrSplit[i]?.trim()
                if (line == "}" && this.rawStrSplit[i]?.match(/^\s*/)[0].length == 0) {
                    break
                }
                contents.push(line)
            }
            this.js.push(contents.join("\n"))
            this.currentLineIndex += ignoreLineCount
        }
        // Call Structure
        else if (/^[A-Z]/.test(firstKey)) {
            if (Object.keys(this.structures).includes(firstKey.replace(":", ""))) {
                this.structures[firstKey.replace(":", "")](line)
            }
            else {
                this.structures?.["Custom Structure"](line)
            }
        }
        // Declare Structure
        else if (firstKey == "[]") {
            this.structures?.["Declare Structure"](line)
        }
        // Define Style Class
        else if (firstKey[0] == ".") {
            this.css.push(`${line?.trim()} { ${this.gatherAttributes()} }`)
        }
        // Close Div
        else if (firstKey == "/div") {
            this.html.push("</div>")
        }
        // Close Div
        else if (firstKey == "/span") {
            this.html.push("</span>")
        }
        // Close CSS
        else if (firstKey == "/css") {
            this.css.push("}")
        }
        // Custom HTML
        else if (firstKey == ">>>") {
            this.html.push(line.replace(">>>", "")[1])
        }
    }

    // Collects all proceeding attributes for structs
    gatherAttributes(rawReponseBool) {
        let attrStr = ""
        let styleVal = ""
        let callAlt = this.rawStrSplit[this.currentLineIndex]?.match(/^\s*/)[0].length
        let attrAlt = this.rawStrSplit[this.currentLineIndex + 1]?.match(/^\s*/)[0].length
        for (let i = this.currentLineIndex + 1; i < this.rawStrSplit.length; i++) {
            let currAlr = this.rawStrSplit[i]?.match(/^\s*/)[0].length
            let line = this.rawStrSplit[i].trim()
            let key = line.split(":")[0]?.trim()
            let value = line.substring(line.indexOf(":") + 1)?.split("*")[0]?.trim()
            if (this.rawStrSplit[i]?.replaceAll(" ", "").length == 0) continue
            if (this.rawStrSplit[i]?.trim().charAt(0) == "/") {
                continue
            }
            else if (this.rawStrSplit[i].trim().charAt(0) == "@") {
                if (line.includes(":")) {
                    attrStr +=  key.replace("@", "") + "="
                    attrStr += "'" + value + "' "
                }
                else {
                    attrStr += key.replace("@", "") + " "
                }
            }
            else if (currAlr < attrAlt || !(/^[a-z]/.test(this.rawStrSplit[i].trim().charAt(0)))) {
                break
            }
            else {
                key = attributes.translate(key)
                styleVal += `${key}:${value.replaceAll("[", "var(--").replaceAll("]", ")")};`
            }
        }
    
        if (rawReponseBool) {
            return attrStr + (styleVal.length > 0 ? `style="${styleVal.replaceAll('"', "'")}"` : "")
        }
        else {
            return styleVal
        }
    }
    
    // Sends a close call for a wrapper structure
    sendClose(code) {
        let startAlr = this.rawStrSplit[this.currentLineIndex].match(/^\s*/)[0].length
        let insertIndex = this.rawStrSplit.length
        for (let i = this.currentLineIndex + 1; i < this.rawStrSplit.length; i++) {
            let currAlr = this.rawStrSplit[i].match(/^\s*/)[0].length
            if (currAlr <= startAlr && this.rawStrSplit[i].replaceAll(" ", "").length > 0) {
                insertIndex = i
                break
            } 
        }
        this.rawStrSplit.splice(insertIndex, 0, code)
        this.lineOffset += 1
    }

    // Structure Library
    structures = {
        build: {
            struct: (elementName, htmlContent = "", customAttributes = "", elementType = "div")  => {
                this.html.push(liveStateCheck(`${elementType} ui="${elementName}" ${this.gatherAttributes(true)} ${customAttributes}`, htmlContent))
                elementType ? this.sendClose("/" + elementType) : this.sendClose("/div")
            },
            inline: (elementName, customAttributes = "", elementType = "div")  => {
                this.html.push(liveStateCheck(`${elementType} ui="${elementName}" ${this.gatherAttributes(true)} ${customAttributes}`))
            },
            import: (content) => {
                this.html.push(`<div ${this.gatherAttributes(true)} import>`)
                this.html.push(content)
                this.sendClose("/div")
            },
            eachStack: (name)  => {
                let line = this.rawStrSplit[this.currentLineIndex]
                let valWorlSplit = line.split(":")[1].trim().split(" ")
                this.html.push(liveStateCheck(
                    `div ${this.gatherAttributes(true)} ui="${name}" each call="${valWorlSplit[0]}" nick="${valWorlSplit[2]}"`,
                    null
                ))
                this.sendClose("/div")
            },
        },
        // Declare Structure
        "Declare Structure": line => {
            let structName = line?.split("]")[1]?.trim()?.split(":")[0]
            let structInputs = line?.split(":")[1]?.trim()
            this.structures.build.struct(structName, null, `custom_struct inputs="${structInputs}"`)
            this.customStructs[structName] = {
                inputs: structInputs
            }
        },
        // Call Custom Structure
        "Custom Structure": line => { this.structures.build.struct(line?.trim(), "", "custom_struct_call") },
        // General Stacks
        "VStack": line => { this.structures.build.struct("v-stack") },
        "HStack": line => { this.structures.build.struct("h-stack") },
        "Grid": line => { this.structures.build.struct("grid") },
        // Each Stacks
        "GridEachStack": line => { this.structures.build.eachStack("grid") },
        "VEachStack": line => { this.structures.build.eachStack("v-stack") },
        "HEachStack": line => { this.structures.build.eachStack("h-stack") },
        // Imports
        "Import": line => {
            if (!this.srcDir) return
            let fileName = line?.split(":")[1]?.trim()
            
            try{
                let fileContent = fs.readFileSync(path.join(this.srcDir, `${fileName}.rue`), 'utf-8')
                new View(fileContent, resDOM => {
                    this.structures.build.import(resDOM.html)
                    this.endHtml.push(resDOM.endHtml)
                    this.head.push(resDOM.head)
                    this.js.push(resDOM.js)
                    this.css.push(resDOM.css)
                }, this.srcDir)
            } catch (error) {
                this.structures.build.struct("text", "Import Error: " + fileName, "style='background: coral; padding: 8pt; color: black;'")
            }
        },
        "ImportJS": line => {
            let val = line.split(":")[1].trim()
            this.endHtml.push(`<script ${this.gatherAttributes(true)} src="${val}.js"></script>`)
        },
        "ImportJSURL": line => {
            let val = line.split(":")[1].trim()
            this.head.push(`<script ${this.gatherAttributes(true)} src="https://${val}"></script>`)
        },
        "ImportCSS": line => {
            let val = line.split(":")[1].trim()
            this.head.push(`<link rel="stylesheet" href="${val}.css">`)
        },
        "ImportCSSURL": line => {
            let val = line.split(":")[1].trim()
            this.head.push(`<link ref="stylesheet" ${this.gatherAttributes(true)} href="https://${val}">`)
        },
        "ImportFA": line => {
            this.head.push(`<script src="https://kit.fontawesome.com/5cf062dc93.js"></script>`)
        },
        // General HTML Elements
        "Image": line => {
            this.html.push(`<img ${this.gatherAttributes(true)} src='${line.split(":")[1].trim()}'>`)
        },
        "ImageURL": line => {
            this.html.push(`<img ${this.gatherAttributes(true)} src='https://${line.split(":")[1].trim()}'>`)
        },
        // Blocks
        "Block": line => { this.structures.build.struct("block") },
        "Wrapper": line => { this.structures.build.struct("block") },
        "Element": line => { this.structures.build.struct("block") },
        // Text
        "Text": line => { this.structures.build.struct("text", line.substring(line.indexOf(":") + 1)?.trim()) },
        "Link": line => { this.structures.build.struct("link") },
        "Button": line => { this.structures.build.struct("button", line.substring(line.indexOf(":") + 1)?.trim(), null ,"button") },
        "Span": line => { this.structures.build.struct("span", line.substring(line.indexOf(":") + 1)?.trim(), null, "span") },
        // Other HTML Elements
        "Audio": line => { this.structures.build.struct("audio", null, null, "audio") },
        "Input": line => { this.structures.build.inline("input", null, "input") },
        // HTML Meta Config
        "PageTitle": line => {
            const title = line.split(":")[1]?.trim();
            this.head.push(`
                <title>${title}</title>
                <meta name="apple-mobile-web-app-title" content="${title}">
                <meta name="application-name" content="${title}">
            `)
        },
        "PageIcon": line => { 
            let iconPath = line.split(":")[1]?.trim()
            this.head.push(`
                <link rel="apple-touch-icon" sizes="180x180" href="${iconPath}">
                <link rel="icon" type="image/png" sizes="32x32" href="${iconPath}">
                <link rel="icon" type="image/png" sizes="16x16" href="${iconPath}">
            `);
        },
    }
}


// Base HTML, CSS, and JS
export function getBaseHeadHTML(__assetsDir) {
    let htmlArr = [
        fs.readFileSync(path.join(__assetsDir, 'meta.html'), 'utf-8'),
    ];
    return htmlArr.join("\n");
}
export function getBaseCSS(__assetsDir) {
    let cssArr = [
        fs.readFileSync(path.join(__assetsDir, 'structures.css'), 'utf-8'),
    ];
    return cssArr.join("\n");
}
export function getBaseJS(__assetsDir, liveServerBool) {
    if (__assetsDir == null) return fs.readFileSync(path.join(__assetsDir, 'live.js'), 'utf-8')
    let jsArr = [
        fs.readFileSync(path.join(__assetsDir, 'state.js'), 'utf-8'),
        fs.readFileSync(path.join(__assetsDir, 'store.js'), 'utf-8'),
    ];
    if (liveServerBool) jsArr.push(fs.readFileSync(path.join(__assetsDir, 'live.js'), 'utf-8'));
    return jsArr.join("\n");
}


// Shortcut Attribute Dictionary
const attributes = {
    dictionary: {
        "align": "text-align",
        "size": "font-size",
        "weight": "font-weight",
        "spacing": "letter-spacing",
        "grid-row": "grid-template-rows",
        "grid-row-span": "grid-row",
        "grid-column": "grid-template-columns",
        "grid-column-span": "grid-column",
        "ratio": "aspect-ratio",
    },
    translate: (key) => {
        if (Object.keys(attributes.dictionary).includes(key)) {
            return attributes.dictionary[key]
        }
        else {
            return key
        }
    }
}

function liveStateCheck(elemWrapper = "div", elemContent = "") {
    let encodedWrapper = encodeHTML(elemWrapper);
    let encodedContent = encodeHTML(elemContent);
    let tagString = `live wrapper="${encodedWrapper}" content="${encodedContent}"`
    
    if (elemContent.includes("{") || elemContent.includes("{")) {
        return `<${elemWrapper} ${tagString}>`;
    }
    else if (elemWrapper.includes("{") || elemWrapper.includes("{")) {
        return `<${elemWrapper} ${tagString}>${elemContent}`;
    }
    else {
        return `<${elemWrapper}>${elemContent}`;
    }
}

let encodeHTMLElements = [
    ['"', '&dQuote'],
    ["'", "&sQuote"],
    ["(", "&oParen"],
    [")", "&cParen"],
    ["[", "&oBrack"],
    ["]", "&cBrack"],
    ["{", "&oBrace"],
    ["}", "&cBrace"],
    ["<", "&oHTML"],
    [">", "&cHTML"],
]
function encodeHTML(html) {
    encodeHTMLElements.forEach(charArr => {
        html = html?.replaceAll(charArr[0], charArr[1])
    })
    return html
}
function decodeHTML(html) {
    encodeHTMLElements.forEach(charArr => {
        html = html?.replaceAll(charArr[1], charArr[0])
    })
    return html
}