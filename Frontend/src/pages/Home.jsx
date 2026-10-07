import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import './Home.css'

const Home = () => {
  // Reset scroll position to top when visiting the page
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="home page-container">
      {/* Background Glowing Blobs */}
      <div className="glow-blob glow-blob-1"></div>
      <div className="glow-blob glow-blob-2"></div>
      <div className="tech-overlay"></div>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content" data-aos="fade-up">
          <div className="hero-badge">
            <i className="fas fa-microchip"></i> Next-Gen Smart Mobility
          </div>
          <h1 className="hero-title">
            AI-Enhanced <span className="highlight-text">Smart Parking</span>
          </h1>
          <p className="hero-subtitle">
            Navigate the future of urban mobility with real-time prediction modeling, 3D interactive structural maps, and seamless automated bookings.
          </p>
          <div className="hero-buttons">
            <Link to="/map" className="btn btn-primary glowing-btn">
              <i className="fas fa-map-marked-alt"></i> Find Parking Space
            </Link>
            <Link to="/dashboard" className="btn btn-secondary">
              <i className="fas fa-chart-line"></i> View Live Analytics
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <div className="section-header-block">
            <span className="section-badge">Platform Pillars</span>
            <h2 className="section-title">High-Tech Solutions</h2>
            <p className="section-desc">Experience advanced engineering built for smart cities and smooth commutes.</p>
          </div>
          
          <div className="features-grid">
            <div className="feature-card f-card-1">
              <div className="feature-glow-glow"></div>
              <div className="feature-icon neon-cyan">
                <i className="fas fa-map-location-dot"></i>
              </div>
              <h3>Real-Time Navigation</h3>
              <p>Direct live location tracking and dynamic route guidance to available commercial spaces, fully integrated with OpenStreetMap layers.</p>
            </div>

            <div className="feature-card f-card-2">
              <div className="feature-glow-glow"></div>
              <div className="feature-icon neon-purple">
                <i className="fas fa-brain"></i>
              </div>
              <h3>AI Vacuum Prediction</h3>
              <p>Hyperparameter-tuned XGBoost model predicts slot vacancy chances dynamically based on Exit Proximity, Spot Dimensions, and Traffic.</p>
            </div>

            <div className="feature-card f-card-3">
              <div className="feature-glow-glow"></div>
              <div className="feature-icon neon-blue">
                <i className="fas fa-cubes"></i>
              </div>
              <h3>3D Structural Maps</h3>
              <p>Interactive virtual mapping of multi-tier slots layout for intuitive grid navigation from entry gates straight to your spot.</p>
            </div>

            <div className="feature-card f-card-4">
              <div className="feature-glow-glow"></div>
              <div className="feature-icon neon-green">
                <i className="fas fa-shield-halved"></i>
              </div>
              <h3>Automated Security</h3>
              <p>Secure timeout booking releases, real-world regex vehicle license-plate validators, and strict administrator security overrides.</p>
            </div>

            <div className="feature-card f-card-5">
              <div className="feature-glow-glow"></div>
              <div className="feature-icon neon-pink">
                <i className="fas fa-chart-pie"></i>
              </div>
              <h3>Analytics Dashboard</h3>
              <p>Integrated data panels tracks occupancy ratios, bookings, customer profiles, and total revenue records in real-time.</p>
            </div>

            <div className="feature-card f-card-6">
              <div className="feature-glow-glow"></div>
              <div className="feature-icon neon-yellow">
                <i className="fas fa-database"></i>
              </div>
              <h3>Local MongoDB Sync</h3>
              <p>Blazing-fast queries mapped to a local database system for immediate transactions, bookings, and instant user updates.</p>
            </div>
          </div>
        </div>
      </section>


      {/* Testimonials Section */}
      <section className="testimonials-section">
        <div className="container">
          <div className="section-header-block">
            <span className="section-badge">Client Reviews</span>
            <h2 className="section-title">Loved by Commuters</h2>
            <p className="section-desc">Hear how our high-tech smart mobility system resolves daily markaz parking struggles.</p>
          </div>

          <div className="testimonials-grid">
            <div className="testimonial-card">
              <div className="rating">
                <i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i>
              </div>
              <p className="quote">"Before this system, my customers spent 20 minutes finding parking in F-8. Now they book slots dynamically and get guided in 3 minutes. The revenue impact is immense!"</p>
              <div className="user-profile">
                <div className="user-avatar-initials blue">HK</div>
                <div>
                  <h4>Haris Khan</h4>
                  <p>Centaurus Retailer</p>
                </div>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="rating">
                <i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i>
              </div>
              <p className="quote">"The AI predictions are incredibly accurate! Even during 9:00 AM rush hour commutes in Blue Area, I know exactly which executive slot is close to the elevator and waiting for me."</p>
              <div className="user-profile">
                <div className="user-avatar-initials purple">AM</div>
                <div>
                  <h4>Ayesha Malik</h4>
                  <p>Blue Area Commuter</p>
                </div>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="rating">
                <i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i>
              </div>
              <p className="quote">"The local database booking architecture and real-time dashboard analytics give us unparalleled control over markaz parking availability. An absolute game-changer!"</p>
              <div className="user-profile">
                <div className="user-avatar-initials green">ZS</div>
                <div>
                  <h4>Zainab Shah</h4>
                  <p>Urban Planner</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-card">
            <div className="cta-glow-overlay"></div>
            <h2>Ready to Secure Your Parking Space?</h2>
            <p>Join thousands of drivers who have transformed their daily commutes. Get access to predictive AI availability, structural layouts, and automated reservations in under 1 minute.</p>
            <div className="cta-buttons">
              <Link to="/register" className="btn btn-primary glowing-btn">Register Account Now</Link>
              <Link to="/map" className="btn btn-secondary text-white">Proceed to Map</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home
