const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  // Get the Authorization header
  const authHeader = req.headers['authorization'];
  
  // Check if Authorization header exists and has the Bearer token
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(403).json({ message: 'Access denied. Authorization failed.' });
  }

  // Extract the token (remove 'Bearer ' from the header)
  const token = authHeader.split(' ')[1];

  try {
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach the decoded user info to the request
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(403).json({ message: 'Invalid token' });
  }
};

module.exports = authenticateToken;
