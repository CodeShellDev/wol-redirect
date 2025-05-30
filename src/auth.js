const router = require('express').Router()

const session = require('express-session')
const cookieParser = require('cookie-parser')

//const axios = require('axios')

const passport = require('passport')
const OAuth2Strategy = require('passport-oauth2')

const SESSION_KEY = process.env.SESSION_KEY
const AUTH_URL = process.env.AUTH_URL
const RESOURCE_URL = process.env.RESOURCE_URL
const LOGOUT_URL = process.env.LOGOUT_URL
const TOKEN_URL = process.env.TOKEN_URL
const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET
const REDIRECT_URL = process.env.REDIRECT_URL
const ACTUAL_URL = new URL(process.env.REDIRECT_URL);
const SCOPE = process.env.SCOPE

passport.use(
    new OAuth2Strategy({
        authorizationURL: AUTH_URL,
        tokenURL: TOKEN_URL,
        clientID: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        callbackURL: REDIRECT_URL,
        scope: SCOPE
    },
    ( accessToken, refreshToken, profile, done ) => {
        return done(null, { accessToken })
    }
    /*async (accessToken, refreshToken, profile, done) => {
        try {
            const response = await axios.get(RESOURCE_URL, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });
    
            const userProfile = response.data

            console.log(userProfile)
    
            return done(null, userProfile)
        } catch (error) {
            console.log('Error fetching user info:', error)

            return done(error)
        }
    }*/
))

passport.serializeUser((user, done) => {
    done(null, user)
})

passport.deserializeUser((obj, done) => {
    done(null, obj)
})

router.use(cookieParser("C00K13-K3Y"))
router.use(session({
    secret: SESSION_KEY,
    resave: false,
    saveUninitialized: true,
}))

router.use(passport.initialize())
router.use(passport.session())

router.get('/', (req, res, next) => {
    if (req.query.serviceUrl) {
        res.cookie("serviceUrl", req.query.serviceUrl, { domain: ACTUAL_URL.host, maxAge: 300000 })
    }

    console.log(`Client requested ${req.hostname}, redirecting to ${ACTUAL_URL.hostname}`)

    if (req.hostname != ACTUAL_URL.hostname) {
        const originalHost = req.headers['x-forwarded-host'] || req.get('host')
        const originalProto = req.headers['x-forwarded-proto'] || req.protocol
        const originalUri = req.headers['x-forwarded-uri'] || req.originalUrl
        const originalUrl = originalProto + '://' + originalHost + originalUri
            
        return res.redirect(ACTUAL_URL.origin+"?serviceUrl="+originalUrl)
    }

    if (!req.isAuthenticated()) {
        return res.redirect('/auth')
    }

    return res.render('home')
})

router.get('/auth', passport.authenticate('oauth2'))

router.get('/auth/callback', passport.authenticate('oauth2'), (req, res) => {
    res.redirect('/')
})

router.get('/logout', (req, res) => {
    if (!req.isAuthenticated()) {
        return
    }

    req.logout(() => {
        res.redirect(LOGOUT_URL)
    })
})

module.exports = router
