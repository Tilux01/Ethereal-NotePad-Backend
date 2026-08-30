const express = require("express")
const app = express()
const mongoose = require("mongoose")
const dotenv = require("dotenv").config()
const port = process.env.PORT || 5000
const URI = process.env.URI
const cors = require("cors")
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors())
const nodemailer = require("nodemailer")
const multer = require("multer")
const cloudinary = require("cloudinary").v2
const upload = multer({ dest: 'uploads/' })
const fs = require ("fs")
const util = require("util")
const { type } = require("os")
const { Resend } = require("resend")
const readFile = util.promisify(fs.readFile);

const resend = new Resend('re_EHVQbSVH_FFMoaUK9wNyEFDYXnumv57Wn');
mongoose.connect(URI)
.then((output)=>{
    console.log("mongoose connected successfully");
})
.catch((err)=>{
    console.log("Error connecting to mongo db", err);
})

cloudinary.config({
    cloud_name: process.env.cloudName,
    api_key: process.env.cloudApiKey,
    api_secret: process.env.cloudApiSecret
})



const transporter = nodemailer.createTransport({
    service:"gmail",
    host: "smtp.gmail.com",
    port: process.env.transporterPort,
    secure: true,
    auth: {
        user: process.env.transporterUser,
        pass: process.env.transporterPass,
    },
    tls: {
        rejectUnauthorized: false 
    }
});

const userCredSchema = new mongoose.Schema({
    firstName: {type:String},
    lastName: {type: String},
    email: {type: String},
    country: {type: String},
    password: {type: String},
    activated: {type: Boolean}
})
const noteSchema = new mongoose.Schema({
    mail:{type: String, required: true},
    noteTitle:{type: String},
    noteText: {type: String},
    imageUrl: {type: String},
    section: {type: String, default: "allNote"},
    stared: {type: Boolean, default:false},
    reminder: {type: Boolean, default: false},
    reminderDate: {type: String},
    category: {type: String, default:"1"},
    collection: {type: String},
    index: {type: Boolean, default: true},
    pinned: {type: Boolean, default: false},
    favourite: {type: Boolean, default: false},
    background: {type: String, default: "rgb(135,186,245)"},
    dateCreated: {type: String}
})
const tagSchema = new mongoose.Schema({
    mail: {type: String},
    tagName: {type: String},
    color: {type: String}
})
const userCredlink = mongoose.model("Users", userCredSchema)
const notePad = mongoose.model("Notes", noteSchema)
const tag = mongoose.model("Tags", tagSchema)
const allAwaitingApporval = []

let allOTP = []



app.get("/",(req, res)=>{
    console.log("This is server running for To Do List application");
    res.sendFile(__dirname+"/index.html")
})

app.get("/note", (req,res)=>{
    res.sendFile(__dirname+"/uploadNote.html")
})

app.get("/accessAccount", (req, res)=>{
    res.sendFile(__dirname+"/login.html")
})

app.get("/resenOTPFile", (req, res)=>{
    res.sendFile(__dirname+"/resendOTP.html")
})


app.get("/dashboard", (req,res)=>{
    res.sendFile(__dirname+"/dashboard.html")
})

app.get("/editNoteFile", (req, res)=>{
    res.sendFile(__dirname+"/editNote.html")
})

app.post("/signup",(req, res)=>{
    if (!req.body) {
        
        return
    }
    console.log("hello world");
    const cred = {...req.body, activated: false}
    console.log(cred);
    
    if (req.body.email) {
        userCredlink.findOne({email: req.body.email})
        .then((output)=>{
            console.log("result", output);
            if (output) {
                res.status(501).json({message:"User with the email already existed"})
            }
            else{
                const data = new userCredlink(cred);
                data.save()
                .then((data)=>{
                    console.log("data saved successfully");
                    const OTP = getRandom()
                    const message = emailMessage(req.body.firstName, OTP)
                    const removeOldOTP = allOTP.filter(cred => cred.mail != req.body.email)
                    removeOldOTP.push({mail: req.body.email, OTP})
                    allOTP = removeOldOTP;
                    resend.emails.send({
                        from: 'onboarding@resend.dev',
                        to: req.body.email,
                        subject: "Hello from Ethereal",
                        html: message
                    });
                    console.log("sent successfuly");
                    res.status(201).json({message:"OTP sent successfully"})
                    // .then((output)=>{
                    // })
                    // .catch((error)=>{
                    //     console.log(error);
                    //     res.status(501).json({message:"error sending OTP", error})
                    // })
                })
                .catch((error)=>{
                    console.log(error);
                    res.status(501).json({message:"Error while sending credentials"})
                })
            }
        })
        .catch((error)=>{
            console.log(error);
            res.status(501).json({message:"Network Error", error})
        })
    }  
    else{
        res.status(501).json({message:"Error, missing parameters"})
    }  
})

app.post("/singin", (req, res)=>{
    const email = req.body.email
    const password = req.body.password
    userCredlink.findOne({email})
    .then((output)=>{
        console.log(output);
        if (!output) {
            res.status(501).json({message:"No user found with the Mail"})
        }
        else if(!output.password || output.password != password){
            res.status(501).json({message:"Error, Incorrect password"})
        }
        else{
            res.status(201).json({message:output})
        }
    })
    .catch((error)=>{
        res.status(501).json({message: "Error fetching user credentials"})
    })
})

app.post("/fetchUserCred",(req, res)=>{
    const email = req.body.email
    userCredlink.findOne({email})
    .then((output)=>{
        console.log(output);
        if (!output) {
            res.status(501).json({message:"No user found with the mail"})
        }
        else{
            res.status(201).json({message:output})
        }
    })
    .catch((error)=>{
        res.status(501).json({message: "Error fetching user credentials"})
    })
})


app.post("/confirmOTP", (req,res)=>{
    const mail = req.body.mail
    OTP = req.body.OTP
    const userCred = allOTP.filter(cred => cred.mail == mail)
    if (userCred.length > 0 && userCred) {
        console.log(userCred[0].OTP);
        if (userCred[0].OTP == OTP) {
            userCredlink.findOneAndUpdate(
                {email: mail},
                {$set: {
                    activated : true
                }},
                {
                    new: true,
                    runValidators: true
                }
            )
            .then((output)=>{
                res.status(201).json({message:"OTP validation successful"})
                const filterOTP = allOTP.filter(cred => cred.mail != mail)
                allOTP = filterOTP
                console.log("after update", output);
            })
            .catch((error)=>{
                res.status(501).json({message:"Error updating user validation"})
                console.log(error);
            })
        }
        else{
            res.status(501).json({message:"Error invalid OTP"})
        }
    }
    else{
        res.status(501).json({message:"This mail is not linked with any OTP, please resend OTP"})
    }
})

app.post("/resendOTP",(req, res)=>{
    const OTP = getRandom()
    const message = emailMessage(req.body.firstName, OTP)
    const removeOldOTP = allOTP.filter(cred => cred.mail != req.body.email)
    removeOldOTP.push({mail: req.body.email, OTP})
    allOTP = removeOldOTP;
    resend.emails.send({
        from: 'onboarding@resend.dev',
        to: req.body.email,
        subject: "Hello from Ethereal",
        html: message
    });
    res.status(201).json({message:"OTP resend successful"})
    console.log("sent successfuly");
    // .then((output)=>{
    // })
    // .catch((error)=>{
    //     res.status(501).json({message:"Error resending OTP"})
    //     console.log(error);
    // })
})


app.post("/fetchAllNote", (req, res)=>{
    const mail = req.body.mail
    console.log(mail);
    notePad.find({mail})
    .then((output)=>{
        res.status(201).json({message:output})
    })
    .catch((error)=>{
        res.status(501).json({message:"Error fetching Notes or no notes avaialable"})
        console.log(error);
    })
})

app.post("/uploadNote",upload.single("image"), (req, res, next)=>{
    const cred = {
        ...req.body,
        section: "allNote",
        stared: false,
    }
    if (req.file) {
        console.log(req.file);
        readFile(req.file.path)
        .then((buffer)=>{
            const b64 = buffer.toString("base64")
            const data = `data:${req.file.mimetype};base64,${b64}`
            cloudinary.uploader.upload(data,{
                folder: "Ethereal Notepad",
                resource_type: "auto",
                quality:"auto:low",
                format: "webp"
            })
            .then((output)=>{
                cred.imageUrl = output.secure_url
                const noteSave = new notePad(cred)
                noteSave.save()
                .then((noteObj)=>{
                    res.status(201).json({message:noteObj})
                })
                .catch((error)=>{
                    res.status(501).json({message:"Error saving note", error})
                })
            })
            .catch((error)=>{
                res.status(501).json({message:"Error saving image"})
                console.log(error);
            })
        })
    }
    else{
        console.log(cred);
        const noteSave = new notePad(cred)
        noteSave.save()
        .then((noteObj)=>{
            res.status(201).json({message:noteObj})
        })
        .catch((error)=>{
            res.status(501).json({message:"Error saving note", error})
        })
    }
    
})

app.post("/editNoteValue", (req, res)=>{
    const valueToEdit = req.body.valueToEdit
    const value = req.body.value
    const id = req.body.id
    if (valueToEdit != "mail") {
        notePad.findByIdAndUpdate(
            id,
            {$set:{[valueToEdit]: value}},
            {
                new: true,
                runValidators: true,
                context: "query"
            }
        )
        .then((output)=>{
            console.log("edited value", output);
            res.status(201).json({message:"Note Edited Successfuly"})
        })
        .catch((error)=>{
            res.status(501).json({message:"Error Editing Note, please retry"})
            console.log("error editing note", error);
            
        })
    }
    else{
        res.status(501).json({message:"mail can not be edited"})
    }
})

app.post("/editNote",upload.single("image"), (req, res, next)=>{
    console.log(req.body);
    
    const id = req.body.id
    const cred = req.body
    if (req.file) {
        readFile(req.file.path)
        .then((buffer)=>{
            const b64 = buffer.toString("base64")
            const data = `data:${req.file.mimetype};base64,${b64}`
            cloudinary.uploader.upload(data,{
                folder: "Ethereal Notepad",
                resource_type: "auto",
                quality:"auto:low",
                format: "webp"
            })
            .then((output)=>{
                console.log(output.secure_url);
                cred.imageUrl = output.secure_url
                notePad.findByIdAndUpdate(
                    id,
                    {$set:cred},
                    {
                        new: true,
                        runValidators: true,
                        context: "query"
                    }
                )
                .then((output)=>{
                    console.log("edited value", output);
                    res.status(201).json({message:"Note Edited Successfuly"})
                })
                .catch((error)=>{
                    res.status(501).json({message:"Error Editing Note, please retry"})
                    console.log("error editing note", error);
                    
                })
            })
            .catch((error)=>{
                res.status(501).json({message:"Error saving image"})
                console.log(error);
            })
        })
    }
    else{
        notePad.findByIdAndUpdate(
            id,
            {$set:cred},
            {
                new: true,
                runValidators: true,
                context: "query"
            }
        )
        .then((output)=>{
            console.log("edited value", output);
            res.status(201).json({message:"Note Edited Successfuly"})
        })
        .catch((error)=>{
            res.status(501).json({message:"Error Editing Note, please retry"})
            console.log("error editing note", error);
            
        })
    }
})

app.post("/deleteNote", (req, res)=>{
    const id = req.body.id
    notePad.deleteOne({ _id: id })
    .then(()=>{
        console.log("deleted suc")
    })
    .catch((error)=>{
        console.log(error);
        
    })
})

app.post("/addTag", (req, res)=>{
    const mail = req.body.mail
    const tagName = req.body.tagName
    const color = req.body.color
    const tagCred = new tag({mail, tagName, color})
    tagCred.save()
    .then((output)=>{
        res.status(201).json({message: output})
    })
    .catch((error)=>{
        res.status(501).json({message: error})
        console.log(error);
        
    })
})

app.post("/fetchTags", (req, res)=>{
    const mail = req.body.mail
    tag.find({mail})
    .then((output)=>{
        res.status(201).json({message: output})
    })
    .catch((error)=>{
        res.status(201).json({message: "Error fetching Tags"})        
    })
})

app.post("/editTag", (req, res)=>{
    const id = req.body._id
    tag.findByIdAndUpdate(
        id,
        {$set: req.body},
        {
            new: true,
            runValidators: true,
            context: "query"
        }
    )
    .then((output)=>{
        res.status(201).json({message: "successful"})
        
    })
    .catch((error)=>{
        res.status(501).json({message: error})
        
    })
})

app.post("/deleteTag", (req, res)=>{
    const id = req.body.id    
    tag.deleteOne({_id: id})
    .then(()=>{
        res.status(201).json({message: "successful"})
    })
    .catch((error)=>{
        console.log(error);
        res.status(501).json({message: error})
    })
})

app.listen(port,(req, res)=>{
    console.log("server running on port", port);
})

const getRandom = () =>{
    let OTP = "";
    for (let index = 0; index < 6; index++) {
        const random = Math.floor(Math.random()*9)
        OTP += random
    }
    return OTP;
}

const emailMessage = (name, OTP) =>{
    const message = `
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0c10; -webkit-font-smoothing: antialiased;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0a0c10; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <!-- Main Container -->
                    <table width="100%" max-width="600px" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background: linear-gradient(145deg, #131722 0%, #1a1f2c 100%); border-radius: 24px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(66, 153, 225, 0.1) inset;">
                        
                        <!-- Header with Glow Effect -->
                        <tr>
                            <td align="center" style="padding: 40px 40px 20px 40px;">
                                <div style="width: 70px; height: 70px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); border-radius: 50%; margin: 0 auto 20px auto; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 25px rgba(59, 130, 246, 0.4);">
                                    <span style="font-size: 32px; line-height: 1; color: #ffffff;">✉️</span>
                                </div>
                                <h1 style="color: #ffffff; font-size: 28px; font-weight: 600; margin: 0 0 8px 0; letter-spacing: -0.5px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">Verification Code</h1>
                                <p style="color: #9ca3af; font-size: 16px; margin: 0; line-height: 1.6;">Hello ${name}, Please use the following code to verify your identity</p>
                            </td>
                        </tr>
                        
                        <tr>
                            <td align="center" style="padding: 20px 40px;">
                                <div style="background: linear-gradient(145deg, #1e2433 0%, #252b3d 100%); border-radius: 20px; padding: 30px 20px; border: 1px solid #2d3748; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(59, 130, 246, 0.2) inset;">
                                    <p style="color: #9ca3af; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 2px;">Your OTP Code</p>
                                    <div style="display: inline-block; background: #0f1320; padding: 15px 35px; border-radius: 16px; border: 1px solid #3b82f6; box-shadow: 0 0 25px rgba(59, 130, 246, 0.3);">
                                        <span style="font-family: 'Courier New', monospace; font-size: 48px; font-weight: 700; letter-spacing: 8px; color: #3b82f6; text-shadow: 0 0 20px rgba(59, 130, 246, 0.5);">${OTP}</span>
                                    </div>
                                    <p style="color: #6b7280; font-size: 13px; margin: 20px 0 0 0; border-top: 1px dashed #2d3748; padding-top: 20px;">This code will expire in <span style="color: #f59e0b; font-weight: 600;">10 minutes</span></p>
                                </div>
                            </td>
                        </tr>
                        
                        <!-- Instructions -->
                        <tr>
                            <td align="center" style="padding: 20px 40px;">
                                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                        <td style="background: #1a1f2e; border-radius: 16px; padding: 24px;">
                                            <h3 style="color: #e5e7eb; font-size: 16px; margin: 0 0 15px 0; font-weight: 500;">How to verify:</h3>
                                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                <tr>
                                                    <td width="30" valign="top" style="color: #3b82f6; font-size: 16px; font-weight: 600;">1.</td>
                                                    <td style="color: #9ca3af; font-size: 14px; padding-bottom: 12px;">Enter the 6-digit code on the verification page</td>
                                                </tr>
                                                <tr>
                                                    <td width="30" valign="top" style="color: #3b82f6; font-size: 16px; font-weight: 600;">2.</td>
                                                    <td style="color: #9ca3af; font-size: 14px; padding-bottom: 12px;">If you didn't request this, ignore this email</td>
                                                </tr>
                                                <tr>
                                                    <td width="30" valign="top" style="color: #3b82f6; font-size: 16px; font-weight: 600;">3.</td>
                                                    <td style="color: #9ca3af; font-size: 14px;">Never share this code with anyone</td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        
                        <!-- Security Notice -->
                        <tr>
                            <td align="center" style="padding: 0 40px 20px 40px;">
                                <div style="background: rgba(239, 68, 68, 0.1); border-radius: 12px; padding: 16px; border-left: 4px solid #ef4444;">
                                    <p style="color: #fecaca; font-size: 13px; margin: 0; display: flex; align-items: center;">
                                        <span style="font-size: 16px; margin-right: 8px;">⚠️</span>
                                        For security reasons, never share this OTP with anyone. Our team will never ask for it.
                                    </p>
                                </div>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td align="center" style="padding: 30px 40px 40px 40px; border-top: 1px solid #2d3748;">
                                <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0;">© 2026 Ethereal NotePad. All rights reserved.</p>
                                <p style="color: #4b5563; font-size: 12px; margin: 0;">
                                    <span style="color: #3b82f6;">Need help?</span> Contact us at 
                                    <a href="mailto:chizaramesther298@gmail.com" style="color: #8b5cf6; text-decoration: none; border-bottom: 1px dashed #8b5cf6;">chizaramesther298@gmail.com</a>
                                </p>
                                <div style="margin-top: 20px;">
                                    <a href="#" style="color: #6b7280; font-size: 12px; text-decoration: none; margin: 0 10px;">Privacy Policy</a>
                                    <span style="color: #3b82f6;">•</span>
                                    <a href="#" style="color: #6b7280; font-size: 12px; text-decoration: none; margin: 0 10px;">Terms of Service</a>
                                    <span style="color: #3b82f6;">•</span>
                                    <a href="#" style="color: #6b7280; font-size: 12px; text-decoration: none; margin: 0 10px;">Unsubscribe</a>
                                </div>
                            </td>
                        </tr>
                    </table>
                    
                    <!-- Tiny Footer Note -->
                    <p style="color: #4b5563; font-size: 11px; margin-top: 20px;">This is an automated message, please do not reply to this email.</p>
                </td>
            </tr>
        </table>
    </body>
    `

    return message
}