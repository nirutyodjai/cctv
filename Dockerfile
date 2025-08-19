FROM nginx:alpine

# Copy files to nginx directory
COPY . /usr/share/nginx/html/cctv/

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Set correct permissions
RUN chmod -R 755 /usr/share/nginx/html/cctv/

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
