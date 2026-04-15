const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const db = require('../db/knex');

const router = express.Router();

// Configure Passport Google OAuth strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const { id: google_id, displayName: name, emails } = profile;
        const email = emails[0].value;

        // Upsert user by google_id
        const [user] = await db('users')
          .where('google_id', google_id)
          .select('*');

        let userId;
        if (user) {
          userId = user.id;
        } else {
          // New user — create with null primary_workspace_id
          // Admin will assign workspace later
          const [inserted] = await db('users')
            .insert({
              google_id,
              email,
              name,
              primary_workspace_id: null,
              created_at: new Date(),
              last_modified_at: new Date(),
            })
            .returning('id');
          userId = inserted.id;
        }

        return done(null, { id: userId, email, name, google_id });
      } catch (err) {
        return done(err);
      }
    }
  )
);

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (userId, done) => {
  try {
    const user = await db('users').where('id', userId).first();
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Google OAuth initiation
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/?auth_error=oauth_failed' }),
  async (req, res) => {
    try {
      const user = req.user;

      // Check if user has a primary workspace assigned
      if (!user.primary_workspace_id) {
        return res.redirect('/?auth_error=no_workspace_assigned');
      }

      // Get workspace membership to verify access + get role
      const membership = await db('workspace_users')
        .where({ workspace_id: user.primary_workspace_id, user_id: user.id })
        .first();

      if (!membership) {
        return res.redirect('/?auth_error=no_workspace_access');
      }

      // Issue JWT
      const token = jwt.sign(
        {
          user_id: user.id,
          workspace_id: user.primary_workspace_id,
          role: membership.role,
          email: user.email,
          name: user.name,
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Redirect to frontend with token
      res.redirect(`/?token=${token}`);
    } catch (err) {
      console.error('OAuth callback error:', err);
      res.redirect('/?auth_error=server_error');
    }
  }
);

// Logout
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ ok: true });
  });
});

module.exports = router;
