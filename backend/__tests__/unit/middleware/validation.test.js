const { sanitizeHtml } = require('../../../middleware/validation');

describe('Validation Middleware', () => {
  describe('sanitizeHtml', () => {
    it('should escape HTML special characters', () => {
      const input = '<script>alert("XSS")</script>';
      const result = sanitizeHtml(input);

      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    it('should escape quotes', () => {
      const input = 'Test "quotes" and \'apostrophes\'';
      const result = sanitizeHtml(input);

      expect(result).not.toContain('"');
      expect(result).not.toContain("'");
      expect(result).toContain('&quot;');
      expect(result).toContain('&#x27;');
    });

    it('should escape ampersands', () => {
      const input = 'Test & ampersand';
      const result = sanitizeHtml(input);

      expect(result).toContain('&amp;');
    });

    it('should escape forward slashes', () => {
      const input = 'path/to/file';
      const result = sanitizeHtml(input);

      expect(result).toContain('&#x2F;');
    });

    it('should return empty string for null/undefined', () => {
      expect(sanitizeHtml(null)).toBe('');
      expect(sanitizeHtml(undefined)).toBe('');
      expect(sanitizeHtml('')).toBe('');
    });

    it('should handle complex XSS attempts', () => {
      const input = '<img src="x" onerror="alert(1)">';
      const result = sanitizeHtml(input);

      // HTML tags are escaped, making the XSS attempt non-functional
      expect(result).not.toContain('<img');
      expect(result).toContain('&lt;img');
      expect(result).not.toContain('>');
      expect(result).toContain('&gt;');
    });

    it('should handle nested tags', () => {
      const input = '<div><script>evil()</script></div>';
      const result = sanitizeHtml(input);

      expect(result).not.toContain('<div>');
      expect(result).not.toContain('<script>');
    });
  });
});
