const { exec } = require("child_process");

var verbose_level = 3;

module.exports = {

    printTitle(nb) {
        console.log('\033c');
        var colorTab =[
            [196, 178, 197, 166, 130, 94, 52, 1, 130, 133, 126, 174, 202, 203, 196, 217, 208, 167],
            [255, 254, 253, 252, 251, 250, 249, 248, 247, 246, 245, 244, 243, 242, 241, 240, 239],
            [87, 86, 84, 83, 82, 81, 80, 79, 79, 77, 76, 75, 74, 73, 72, 71, 70, 69, 68, 67, 66],
            [230, 229, 228, 227, 226, 225, 224, 223, 222, 221, 220, 219, 218, 217, 216, 215, 214, 213],
            [69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 93, 84, 85, 86],
            [255, 254, 253, 252, 190, 191, 192, 193, 194, 195],
            [123, 89, 212, 20],
            [73,57,12,96,154,78],
            [94,67,42,187,44,46],
            [66,33,44,55,66,77,88,99],
            [3,4,5,6,7,8,9,10,11,12,13,14],
            [83,69,14,74,139,123,118,176,111],
            [255, 254, 253, 252, 160, 161, 162, 163, 164, 165],
            [255, 254, 253, 252, 24, 25, 26, 27, 28, 29, 30, 31],
            [255, 254, 253, 252, 184, 185, 186, 187, 188, 189, 190],
            [255, 254, 253, 252, 88, 89, 80, 91, 92, 93, 94, 95, 96, 97]
        ]
        
        var str2 = "";
        var str = " .d888                          888      888\n"
        +"d88P\"                           888      888\n"
        +"888                             888      888\n"
        +"888888 888d888 .d88b.   .d88b.  88888b.  888888 .d8888b\n"
        +"888    888P\"  d8P  Y8b d8P  Y8b 888 \"88b 888   d88P\"\n"
        +"888    888    88888888 88888888 888  888 888   888\n"
        +"888    888    Y8b.     Y8b.     888 d88P Y88b. Y88b.\n"
        +"888    888     \"Y8888   \"Y8888  88888P\"   \"Y888 \"Y8888P ";
        var rdi1 = colorTab.length-1;
        var colorset = colorTab[this.rdn(0, rdi1)];
        var rdi2 = colorset.length-1
        for (var i = 0; i < str.length; i++) {
            str2 += "\x1b[38;5;"+colorset[this.rdn(0, rdi2)]+"m"+str[i]+"\x1b[0m";
        }
        console.log(str2+' \n\n17J4CK:'+nb+":"+new Date().toISOString()+"\n");
    },

    shuffle (array) {
        for(let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * i);
            const temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
        return array;
    },

    log (type, function_name, message) {
        var str = "";
        if (type == 1) {
        str = "\x1b[38;5;2m[INFO]\x1b[0m "+new Date().toISOString().slice(0, 23).replace('T',' ');
        } else if (type == 2) {
        str = "\x1b[38;5;3m[WARNING]\x1b[0m "+new Date().toISOString().slice(0, 23).replace('T',' ');
        } else if (type == 3) {
        str = "\x1b[38;5;1m[ERROR]\x1b[0m "+new Date().toISOString().slice(0, 23).replace('T',' ');
        }
        str = str + " \x1b[38;5;134m"+function_name+": \x1b[0m"+message;
        if (verbose_level <= 2 && (type == 3 || (function_name == "processAvailableAccounts()") || function_name == "processAccount()")) {
            console.log(str);
        }
        if (verbose_level == 2 && type == 2) {
            console.log(str);
        }
        if (verbose_level == 3) {
            console.log(str);
        }
    },

    async deleteDir(dir) {
        return new Promise((resolve) => {
            exec("rm -rf "+dir, (error, stdout, stderr) => {
                if (error) {
                    console.log(`error: ${error.message}`);
                    return resolve(0);
                }
                if (stderr) {
                    console.log(`stderr: ${stderr}`);
                    return resolve(0);
                }
                return resolve(1);
            });
        })
    },

    async createDir(dir) {
        return new Promise((resolve) => {
            exec("mkdir "+dir, (error, stdout, stderr) => {
                if (error) {
                    console.log(`error: ${error.message}`);
                    return resolve(0);
                }
                if (stderr) {
                    console.log(`stderr: ${stderr}`);
                    return resolve(0);
                }
                return resolve(1);
            });
        })
    },

    timeConversion(millisec) {
        var seconds = (millisec / 1000).toFixed(1);
        var minutes = (millisec / (1000 * 60)).toFixed(1);
        var hours = (millisec / (1000 * 60 * 60)).toFixed(1);
        var days = (millisec / (1000 * 60 * 60 * 24)).toFixed(1);
        if (seconds < 60) {
            return seconds + " Sec";
        } else if (minutes < 60) {
            return minutes + " Min";
        } else if (hours < 24) {
            return hours + " Hrs";
        } else {
            return days + " Days"
        }
    },
    
    makeInscriptionCode(length) {
        var result           = '';
        var characters       = 'abcdefghijklmnopqrstuvwxyz12345567890';
        var charactersLength = characters.length;
        for ( var i = 0; i < length; i++ ) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    },
    
    makePassword(length) {
        var result           = '';
        var characters       = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMOPQRSTUVWXYZ1234567890';
        var charactersLength = characters.length;
        for ( var i = 0; i < length; i++ ) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    },

    rdn (min, max) {
        min = Math.ceil(min)
        max = Math.floor(max)
        return Math.floor(Math.random() * (max - min)) + min
    },
 
    sleep (ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

};