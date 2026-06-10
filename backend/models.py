from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    plants = db.relationship('Plant', backref='owner', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "created_at": self.created_at.isoformat()
        }

class Plant(db.Model):
    __tablename__ = 'plants'
    
    id = db.Column(db.Integer, primary_key=True)
    nickname = db.Column(db.String(80), nullable=False)
    bitki = db.Column(db.String(120), nullable=False) # species name
    image_url = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    water_frequency_days = db.Column(db.Integer, default=7)
    last_watered_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Relationships
    schedules = db.relationship('CareSchedule', backref='plant', lazy=True, cascade="all, delete-orphan")
    reports = db.relationship('AnalysisReport', backref='plant', lazy=True, cascade="all, delete-orphan", order_by="desc(AnalysisReport.created_at)")

    def to_dict(self):
        # Return base plant specs plus reports history
        return {
            "id": self.id,
            "nickname": self.nickname,
            "bitki": self.bitki,
            "image_url": self.image_url,
            "created_at": self.created_at.isoformat(),
            "water_frequency_days": self.water_frequency_days,
            "last_watered_at": self.last_watered_at.isoformat() if self.last_watered_at else None,
            "reports": [r.to_dict() for r in self.reports]
        }

class AnalysisReport(db.Model):
    __tablename__ = 'analysis_reports'
    
    id = db.Column(db.Integer, primary_key=True)
    plant_id = db.Column(db.Integer, db.ForeignKey('plants.id'), nullable=False)
    sağlık = db.Column(db.Integer, default=100)
    sorun = db.Column(db.String(255), nullable=False)
    yorum = db.Column(db.Text, nullable=True)
    öneri = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "plant_id": self.plant_id,
            "sağlık": self.sağlık,
            "sorun": self.sorun,
            "yorum": self.yorum,
            "öneri": self.öneri,
            "created_at": self.created_at.isoformat()
        }

class CareSchedule(db.Model):
    __tablename__ = 'care_schedules'
    
    id = db.Column(db.Integer, primary_key=True)
    plant_id = db.Column(db.Integer, db.ForeignKey('plants.id'), nullable=False)
    task_type = db.Column(db.String(50), default="water") # water, fertilize, repot, prune
    due_date = db.Column(db.DateTime, nullable=False)
    completed = db.Column(db.Boolean, default=False)
    completed_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "plant_id": self.plant_id,
            "task_type": self.task_type,
            "due_date": self.due_date.isoformat(),
            "completed": self.completed,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None
        }
