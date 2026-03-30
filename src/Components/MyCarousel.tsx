import Carousel from "react-bootstrap/Carousel";

import background from "../assets/Images/background.png";
import "./MyCarousel.css";
import Login from "./Login";
import SignUp from "./Signup";

import { useState } from "react";

function MyCarousel() {
  const [showSignUp, setShowSignUp] = useState<boolean>(false);

  return (
    <Carousel data-bs-theme="dark" interval={null}>
      <Carousel.Item>
        <img src={background} />

        <Carousel.Caption>
          <h1>Welcome to EcoPulse</h1>
          <h3>Our website designed for your responsible shopping</h3>
        </Carousel.Caption>
      </Carousel.Item>
      <Carousel.Item>
        <img src={background} />
        <Carousel.Caption>
          <h1>Our Mission?</h1>
          <h3>
            To promote responsible consumption by limiting impulse-buying and
            encouraging long-term use of sustainable products.
          </h3>
          <h3>Targeting UN Goal 12: Sustainable Consumption by 2050</h3>
          <p>So yes, your use of our website can make a difference</p>
        </Carousel.Caption>
      </Carousel.Item>
      <Carousel.Item>
        <img src={background} />
        <Carousel.Caption>
          <h1>Why should I use this site?</h1>
          <h3>
            Every time you decide to purchase a product, do you wonder if it’s
            worthwhile? Do you use them often? Or do these purchases just pile
            up?
          </h3>
          <h3>
            In our website, simply input the URL of your purchase and our AI
            chat-box will ask personalized questions to help you evaluate your
            purchase and give possible alternatives.
          </h3>
          <p>It’ll save the environment and your wallet!</p>
        </Carousel.Caption>
      </Carousel.Item>
      <Carousel.Item>
        <img src={background} />
        <div className="carousel-form-overlay">
          <div className="auth-inner">
            {showSignUp ? (
              <SignUp goToLogin={() => setShowSignUp(false)} />
            ) : (
              <Login goToSignUp={() => setShowSignUp(true)} />
            )}
          </div>
        </div>
      </Carousel.Item>
    </Carousel>
  );
}

export default MyCarousel;
