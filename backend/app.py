# -*- coding: utf-8 -*-
import os
from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from models import db
from routes.analysis import analysis_bp

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Enable Cross-Origin Resource Sharing
    CORS(app)
    
    # Initialize Database
    db.init_app(app)
    
    # Register blueprints
    app.register_blueprint(analysis_bp, url_prefix='/api')
    
    # Simple Health Check Route
    @app.route('/health', methods=['GET'])
    def health_check():
        return jsonify({
            "status": "healthy",
            "message": "Plantora AI Flask API is active",
            "db_configured": "sqlite" in app.config['SQLALCHEMY_DATABASE_URI'] or "postgresql" in app.config['SQLALCHEMY_DATABASE_URI']
        }), 200

    # Create tables automatically in development
    with app.app_context():
        db.create_all()
        
    return app

if __name__ == '__main__':
    app = create_app()
    port = int(os.environ.get('PORT', 5000))
    # Run server locally
    app.run(host='0.0.0.0', port=port, debug=True)
