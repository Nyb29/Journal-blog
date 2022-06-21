const express = require('express');
const path = require("path");
const mysql = require("mysql");
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const fs = require('fs');
const upload = require('express-fileupload')

let session = require('express-session');
const e = require('express');



dotenv.config({ path: './.env' })

const app = express();

app.use(upload())

let sess = {
    secret: 'secret-key',
    resave: false,
    saveUninitialized: false,
}

app.use(session(sess))

app.use(express.urlencoded());  // to support URL-encoded bodies

const db = mysql.createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE
});

/*const publicDirectory = path.join(__dirname, './public')
app.use(express.static(publicDirectory));*/
app.use(express.static(path.resolve('./public')));


app.set('view engine', 'hbs');

db.connect((error) => {
    if (error) {
        console.log(error)
    } else {
        console.log("My sql connected...")
    }
})

//ROUTING - START 
app.get("/", (req, res) => {

    //load of the blog posts
    db.query("SELECT * FROM cblog_posts ORDER BY creationDate DESC", function (err, posts, fields) {
        if (err) throw err;
        let isMember = false
        if(typeof req.session.user!="undefined"){
            isMember = true
        }
        console.log("isMember",isMember)
        res.render("index", { posts: posts,isMember: isMember })
    });

});

app.get("/posts/:title/:id", (req, res) => {
    //req.params // contains the parameteres that are passed through the URL
    console.log(req.params)
    console.log(req.params.id)
    //query to get the post article by id
    db.query("SELECT * FROM cblog_posts WHERE id=" + req.params.id, function (err, post, fields) {
        if (err) throw err;
        console.log(post)
        post = post[0];
        //post will contain the post data from the database - and we are now calling the hbs template engine

        //check if the post has media files

        let dir =   "./public/posts/"+post['id']+"/" //post folder
        let postFiles = []
        
        //loop through all the files in the folder
        fs.readdir(dir, (err, files) => {
            files.forEach(file => {
                postFiles.push(file) //fill up the postFiles array
            });
          });


        console.log("dir",dir)
        res.render("post", { post: post, postFiles:postFiles,dir:"/posts/"+post['id']+"/"})
    });
})

//show the login form page
app.get("/login", (req, res) => {
    res.render("login")
})

//process the login submit
app.post("/login", (req, res) => {
    let username = req.body.username
    let password = req.body.password

    db.query(`SELECT * FROM cblog_users WHERE username='${username}'`, function (err, user, fields) {
        if (err) throw err;
        console.log(user[0])


        if (typeof user != 'undefined' && user.length != 0) {
            console.log(user[0].password)
            const verified = bcrypt.compareSync(password, user[0].password)
            if(verified){
                req.session.user = user[0]
                res.render("admin/home")
            }else {
                res.send("Error")
            }
            
        } else {
            res.send("Error")
        }

    });
    //

})

app.get("/admin/all-post", (req, res) => {
    if(typeof req.session.user!="undefined"){
        //query to get all the posts from our database
        db.query("SELECT * FROM cblog_posts ORDER BY creationDate DESC", function (err, posts, fields) {
            if (err) throw err;
            //call the .hbs file to show all the posts
            res.render("admin/all-post", { posts: posts })
        });
    }else{ res.send("Access Denied")}
})

app.get("/admin/delete-post/:id", (req, res) => {
    if(typeof req.session.user!="undefined"){
        /* ` used to be able to concatanate strings with variable. 
        We pass the variable wit this strutcure ${}

        `DELETE FROM cblog_posts WHERE id=${req.params.id}` backtick
        "DELETE FROM cblog_posts WHERE id="+req.params.id+""
        */
        db.query(`DELETE FROM cblog_posts WHERE id=${req.params.id}`, function (err, posts, fields) {
            if (err) throw err;

            db.query("SELECT * FROM cblog_posts ORDER BY creationDate DESC", function (err, posts, fields) {
                if (err) throw err;
                res.render("admin/all-post", { posts: posts })
            });
        });
    }else{ res.send("Access Denied")} 
})

app.get("/admin/create-post", (req, res) => {
    if(typeof req.session.user!="undefined"){
        res.render("admin/create-post")
    }else{ res.send("Access Denied")}
})
app.post("/admin/create-post", (req, res) => {
    if(typeof req.session.user!="undefined"){
        console.log("-----------------")
        console.log("start insert post")
        console.log(req.title)
        let title = req.body.title
        let body = req.body.body
        let url = req.body.url
        let private = req.body.private
        let userID = req.session.user.id

        db.query(`INSERT INTO cblog_posts SET title='${title}' , url='${url}' , body='${body}' , visitors=0, creationDate=NOW(), updateDate=NOW(), userID='${userID}', private='${private}'`, function (err, result, fields) {
            if (err) throw err;
            //create the folder
            console.log(result.insertId)
            let postID = result.insertId;

            db.query("SELECT * FROM cblog_posts ORDER BY creationDate DESC", function (err, posts, fields) {
                if (err) throw err;
                console.log(result.insertId)

                let postID = result.insertId;
                const dir = './public/posts/'+postID+'/'
                if (!fs.existsSync(dir)){
                    fs.mkdirSync(dir)                   
                }
                res.render("admin/all-post", { posts: posts })
            });
        });
    }else{ res.send("Access Denied")}
})

app.get("/admin/edit-post/:id", (req, res) => {
    //if(typeof req.session.user!="undefined"){
        db.query(`SELECT * FROM cblog_posts WHERE id=${req.params.id}`, function (err, post, fields) {
            if (err) throw err;
            console.log(post)
            res.render("admin/edit-post", { post: post[0] })
        });
    //}else{ res.send("Access Denied")} 
})

app.post("/admin/upload-post-file/:id", (req, res) => {
    if(req.files){
        console.log(req.params.id)
        let dir =   "./public/posts/"+req.params.id+"/"
        // console.log("post folder:",dir)
        // console.log("Image",req.files)

        //upload image
        let image = req.files.image
        let isImageUploaded = false
        if(typeof image!=="undefined"){
            let imageName = image.name
            console.log(imageName)
            image.mv(dir+imageName,function(err){
                if(err) { 
                    res.send(err)
                }else{
                    isImageUploaded = true
                }
            })
        }

        //upload video
        let isVideoUploaded = false
        let video = req.files.video
        console.log(video)
        if(typeof video!=="undefined"){
            let videoName = video.name
            console.log(videoName)
            video.mv(dir+videoName,function(err){
                if(err) { 
                    res.send(err)
                }else{
                    isVideoUploaded = true
                }
            })
        }

        //upload audio
        let isAudioUploaded = false
        let audio = req.files.audio
        if(typeof audio!=="undefined"){
            let audioName = audio.name
            console.log(audioName)
            audio.mv(dir+audioName,function(err){
                if(err) { 
                    res.send(err)
                }else{
                    isAudioUploaded = true
                }
            })
        }

        // if(isImageUploaded || isVideoUploaded || isAudioUploaded){
        //     res.send("Uploaded completed!")
        // }
        res.send("Uploaded completed!")
    }
})


//ROUTING - END

app.listen(8180, () => {
    console.log("server started on port 8180")
})

