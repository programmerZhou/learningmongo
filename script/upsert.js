blog = db.analytics.findOne({url: "/blog"}); 

if (blog) {
	blog.pageviews++; 
	db.analytics.save(blog); 
} else {
	db.analytics.save({url:"/blog", pageviews: 1}); 
}

