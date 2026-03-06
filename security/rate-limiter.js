/**
 * @file rate-limiter.js
 * @description In-memory rate limiting for strategic API endpoints.
 */

class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
    this.maxRequests = options.maxRequests || 100;
    this.store = new Map(); // ip -> { count, resetTime }
  }
  
  middleware() {
    return (req, res, next) => {
      const ip = this.getClientIP(req);
      const now = Date.now();
      
      // Get or create record for this IP
      let record = this.store.get(ip);
      
      if (!record || now > record.resetTime) {
        // Create new record
        record = {
          count: 0,
          resetTime: now + this.windowMs
        };
        this.store.set(ip, record);
      }
      
      // Increment request count
      record.count++;
      
      // Check if limit exceeded
      if (record.count > this.maxRequests) {
        res.writeHead(429, { 
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((record.resetTime - now) / 1000)
        });
        res.end(JSON.stringify({
          error: 'Too many requests',
          retryAfter: Math.ceil((record.resetTime - now) / 1000)
        }));
        return;
      }
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.maxRequests - record.count));
      res.setHeader('X-RateLimit-Reset', record.resetTime);
      
      next();
    };
  }
  
  /**
   * Manual check without middleware
   */
  checkLimit(req) {
    const ip = this.getClientIP(req);
    const now = Date.now();
    
    let record = this.store.get(ip);
    
    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + this.windowMs
      };
      this.store.set(ip, record);
    }
    
    record.count++;
    
    if (record.count > this.maxRequests) {
      return {
        status: 429,
        message: 'Too many requests',
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      };
    }
    
    return null;
  }

  getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] || 
           req.socket.remoteAddress ||
           'unknown';
  }
  
  cleanup() {
    // Periodically clean up expired records
    const now = Date.now();
    for (const [ip, record] of this.store.entries()) {
      if (now > record.resetTime) {
        this.store.delete(ip);
      }
    }
  }
}

module.exports = RateLimiter;
