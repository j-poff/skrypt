const create = require('./routerfunctions/create')
const auth = require('./routerfunctions/auth')
const mod = require('./routerfunctions/mod')
const mongoose = require('mongoose');
const vars = require('../globalvars')
const userModel = require('./models/user')
const postModel = require('./models/post')
mongoose.connect(vars.monoguri)
const redis = require('redis')
const redisClient = redis.createClient(vars.redisPort, vars.redisIP)

// TODO: REDIS IMPLEMENTATION
/** 
 * Redis Impementation:
 * On request, check redis for data
 * If redis doesn't have it, check mongo then put data in redis
 * If data is updated in mongo, remove (or maybe update?) redis entry
*/

// TODO: CODE CLEANUP AND USAGE OF Model.find().populate() (see '/user/:id/posts' GET request)

module.exports = function (app) {
  // GET Requests
  app.get('/', (req, res) => {
    //console.log(req.cookies)
    const token = req.cookies.token
    if (auth.internalVerify(token)) {
      redisClient.get('globalPosts', function (err, reply) {
        if (reply) {
          const replyObject = JSON.parse(reply)
          res.render('home', {
            title: 'User Home',
            user: auth.getToken(token),
            posts: replyObject
          });
        } else {
          postModel.find({}).populate('author', 'username id').sort({ timePosted : -1}).exec((err, posts) => {
            if (err) throw err
            console.log(posts)
            res.render('home', {
              title: 'User Home',
              user: auth.getToken(token),
              posts: posts
            });
          })
        }
      })
    }
    else res.redirect('/login')

  });

  app.get('/login', (req, res) => {
    const token = req.cookies.token
    if (!auth.internalVerify(token)) res.render('login')
    else res.redirect('/')
  });

  app.get('/register', (req, res) => {
    const token = req.cookies.token
    if (!auth.internalVerify(token)) res.render('register')
    else res.redirect('/')
  })

  app.get('/me', (req, res) => {
    const token = req.cookies.token
    let user = auth.getToken(token)
    if (auth.internalVerify(token)) res.redirect(`/profile/${user.id}`)
    else res.render('login')
  });

  app.get('/profile/:id', (req, res) => {
    const id = req.params.id
    userModel.findOne({
      "_id": id
    }, 'id email username fullname bio blurb picture posts').populate({path: 'posts', populate: { path: 'author', select: 'username _id' }}).exec((err, user) => {
      if (user) {
        res.render('profile', {
        title: 'User Profile',
        user: user,
        posts: (user.posts) ? user.posts : []
      });
      } else res.send("<h1>Cannot find user</h1>")
    })
  })

  app.get('/user/:id', (req, res) => {
    const id = req.params.id
    userModel.findOne({
      "_id": id
    }, 'id email username fullname bio blurb picture').exec((err, user) => {
      if (user) res.json({status:"success",user:user})
      else res.json({status:"fail",error:"cannot find user"})
    })
  })

  app.get('/me/edit', (req, res) => {
    const token = req.cookies.token
    if (token && auth.internalVerify(token)) {
      const user = auth.getToken(token)
      res.render('editprofile', {user: user})
    } else res.redirect('/login')
  })

  app.get('/user/:id/posts', (req, res) => {
    const id = req.params.id
    userModel.findOne({
      "_id": id
    }, 'id email username posts').populate({path: 'posts', populate: { path: 'author', select: 'username _id' }}).exec((err, user) => {
      if (user) res.json({status:"success",user:user})
      else res.json({status:"fail",error:"cannot find user"})
    })
  })

  app.get('/post/:id', (req, res) => {
    const id = req.params.id
    postModel.findOne({"_id": id}).populate({path: 'author', select: 'username _id'}).populate({path: 'likes', select: 'username _id'}).exec((err, post)=>{
      if (post) {
          res.json({status: "success", post: post});
      }
      else res.send("<h1>Cannot find post</h1>")
    })
  })

  app.get('/logout', (req, res) => {
    res.cookie("token", "", {expires: new Date(0)});
    res.redirect('/')
  })

  app.get('/feed', (req, res) => {
    postModel.find({}, function (err, posts) {
      if (err) throw err
      if (posts.length > 0) {
        let newPosts = []
        posts.forEach(post => {
          userModel.findOne({"_id": post.author}, "username id", function (err, user) {
            let newPost = {
              id: post.id,
              author: user,
              content: post.content,
              likes: post.likes,
              title: post.title,
              timePosted: post.timePosted
            }
            newPosts.push(newPost)
            if (newPosts.length === posts.length) res.json({status: "success", posts: newPosts})
            else console.log(newPosts)
          })
        })
      } else res.json({status: "fail"})
    })
  })

  app.get('/post/:id/like', mod.like)

  // POST Requests
  app.post('/user/new', create.user)

  app.post('/login', auth.login)

  app.post('/auth', auth.verify)

  app.post('/post/new', create.post)

  app.post('/me/edit', mod.edituser)

  app.post('/workplace/new', create.workspace)

  app.all('/*', (req, res) => {
    res.json({error:"Function not available"})
  })
}