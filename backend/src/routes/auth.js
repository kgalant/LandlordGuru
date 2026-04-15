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
        console.log('[strategy] OAuth profile received:', { email, google_id, name });

        // Find existing user by email
        const user = await db('users')
          .where('email', email)
          .first();

        if (!user) {
          // User does not exist — fail auth with user message
          console.log('[strategy] User not found:', email);
          return done(new Error(`User ${email} not found. Contact admin to set up your account.`));
        }

        console.log('[strategy] User found, updating google_id');
        // Update google_id and last_modified_at if they changed
        await db('users')
          .where('id', user.id)
          .update({
            google_id,
            name, // Update display name from Google profile
            last_modified_at: new Date(),
          });

        console.log('[strategy] Calling done() with user:', { id: user.id, email: user.email, primary_workspace_id: user.primary_workspace_id });
        return done(null, {
          id: user.id,
          email: user.email,
          name: user.name,
          google_id,
          primary_workspace_id: user.primary_workspace_id
        });
      } catch (err) {
        console.error('[strategy] Error:', err.message);
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
    console.log('[deserializeUser] Fetched user:', { id: user?.id, email: user?.email, primary_workspace_id: user?.primary_workspace_id });
    done(null, user);
  } catch (err) {
    console.error('[deserializeUser] Error:', err.message);
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
      console.log('[callback] req.user:', { id: user?.id, email: user?.email, primary_workspace_id: user?.primary_workspace_id });

      // Check if user has a primary workspace assigned
      if (!user.primary_workspace_id) {
        console.log('[callback] User missing primary_workspace_id');
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
      // Pass the error message to the frontend if available
      const errorMsg = encodeURIComponent(err.message || 'Authentication failed');
      res.redirect(`/?auth_error=${errorMsg}`);
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
