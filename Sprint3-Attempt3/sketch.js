// Multiplayer Hand Pose Painting+Skeleton hands
// https://thecodingtrain.com/tracks/ml5js-beginners-guide/ml5/hand-pose

let video;
let handPose;
let hands = [];
let painting;
let connections;

// Screenshot variables
let screenshotTimer = 0;
let screenshotInterval = 100 * 60 * 1000; // The first number is how many minutes between screenshots

// Color palette and hand tracking
let colorPalette = [
  [40, 167, 69],   // Green
  [255, 20, 20],   // Red
  [54, 162, 235],  // Blue
  [255, 193, 7],   // Yellow
  [0, 0, 0],       // black
  [138, 43, 226],  // Purple
  [255, 140, 0],   // Orange
  [220, 53, 69],   // Crimson
  [32, 201, 151],  // Teal
  [255, 20, 147],  // Deep Pink
  [75, 192, 192],   // Aqua
  [255, 105, 180], // Hot Pink
];

// Track each hand with its own color and previous position
let trackedHands = new Map(); // Map to store hand data by approximate position
let usedColors = []; // Track which colors are currently in use
let handIdCounter = 0;

function preload() {
  handPose = ml5.handPose({ flipped: true });
    soapEmoji = loadImage('soap-emoji2.png');
    hsluLogo = loadImage('hslu-logo.png'); 
}

function mousePressed() {
  console.log(hands);
  console.log("Tracked hands:", trackedHands);
}

function gotHands(results) {
  hands = results;
  updateHandTracking();
}

function checkEraseGesture(hand) {
  // Thumb-to-pinky pinch for erasing
  let thumb = hand.thumb_tip;
  let pinky = hand.pinky_finger_tip;
  let distance = dist(thumb.x, thumb.y, pinky.x, pinky.y);
  return distance < 30; // change number to adjust sensitivity
}

// Function to check if the color change gesture is performed (thumb and middle finger pinch)
function checkColorChangeGesture(hand) {
  let thumbTip = hand.thumb_tip;
  let middleTip = hand.middle_finger_tip;
  let thumbMiddleDistance = dist(thumbTip.x, thumbTip.y, middleTip.x, middleTip.y);
  // If thumb and middle finger are within 25 pixels, consider it a color change gesture
  return thumbMiddleDistance < 25;
}

function updateHandTracking() {
  let currentHandPositions = [];
  
  // Get current hand positions (using wrist as identifier)
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];
    let wrist = hand.keypoints[0]; // Wrist position as hand identifier
    currentHandPositions.push({
      x: wrist.x,
      y: wrist.y,
      handData: hand,
      index: i
    });
  }
  
  // Create new Map for this frame
  let newTrackedHands = new Map();
  let newUsedColors = [];
  
  // Try to match current hands with previously tracked hands
  for (let currentHand of currentHandPositions) {
    let matchedId = null;
    let minDistance = Infinity;
    
    // Look for the closest previously tracked hand
    for (let [id, trackedData] of trackedHands) {
      let distance = dist(currentHand.x, currentHand.y, trackedData.lastX, trackedData.lastY);
      if (distance < 100 && distance < minDistance) { // 100px threshold for matching
        minDistance = distance;
        matchedId = id;
      }
    }
    
    if (matchedId !== null) {
      // This hand was previously tracked, keep its color
      let trackedData = trackedHands.get(matchedId);
      newTrackedHands.set(matchedId, {
        ...trackedData,
        lastX: currentHand.x,
        lastY: currentHand.y,
        handData: currentHand.handData
      });
      newUsedColors.push(trackedData.color);
    } else {
      // This is a new hand, assign it a new color
      let availableColors = colorPalette.filter(color => 
        !newUsedColors.some(usedColor => 
          usedColor[0] === color[0] && usedColor[1] === color[1] && usedColor[2] === color[2]
        )
      );
      
      let newColor;
      if (availableColors.length > 0) {
        newColor = random(availableColors);
      } else {
        // If all colors are used, pick a random one anyway
        newColor = random(colorPalette);
      }
      
      let newId = handIdCounter++;
      newTrackedHands.set(newId, {
        color: newColor,
        lastX: currentHand.x,
        lastY: currentHand.y,
        prevDrawX: currentHand.x,
        prevDrawY: currentHand.y,
        handData: currentHand.handData
      });
      newUsedColors.push(newColor);
      
      console.log(`New hand ${newId} assigned color:`, newColor);
    }
  }
  
  // Update global tracking variables
  trackedHands = newTrackedHands;
  usedColors = newUsedColors;
}

async function setup() {
  createCanvas(720, 410); 

  // Create an off-screen graphics buffer for painting
  painting = createGraphics(820, 610);
  painting.clear();

  // Get list of available video devices
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    
    console.log('Available cameras:');
    videoDevices.forEach((device, index) => {
      console.log(`${index}: ${device.label || `Camera ${index + 1}`} (${device.deviceId})`);
    });

    
    // 0 = first camera (usually built-in), 1 = second camera (usually external), etc.
    const cameraIndex = 0; // Change this to select your external camera
    
    if (videoDevices.length > cameraIndex) {
      const selectedDevice = videoDevices[cameraIndex];
      console.log(`Using camera: ${selectedDevice.label || `Camera ${cameraIndex + 1}`}`);
      
      video = createCapture({
        video: {
          deviceId: selectedDevice.deviceId,
          width: 720,   // Match canvas width
          height: 410,   // Match canvas height
        }
      });
    } else {
      console.log(`Camera index ${cameraIndex} not found, using default camera`);
      video = createCapture({
        video: true,
        audio: false
      });
    }

    video.hide();

    // Start detecting hands
    handPose.detectStart(video, gotHands);
    connections = handPose.getConnections();
    
  } catch (error) {
    console.error('Error accessing cameras:', error);
    // Fallback to default camera
    video = createCapture({
      video: true,
      audio: false
    });
    video.hide();
    handPose.detectStart(video, gotHands);
    connections = handPose.getConnections();
  }
}

function drawTitleAndInstructions() {
  // Title
  textAlign(CENTER, TOP);
  textSize(32);
  fill(30);
  noStroke();
  text("hslu.draw", 100, 24);
  
  // Instructions with emoji
  let instructX = width - 215;
  textAlign(LEFT, TOP);
  textSize(16);
  text("Pinch to draw", instructX, 24);
  text("Thumb + Pinky to erase", instructX, 44);
  text("Thumb + Middle: new color", instructX, 64);
}

function draw() {
  push();
  scale(-1, 1);
  image(video, -width, 0);
  pop();
  background(255);
  


  // Draw for each tracked hand
  for (let [handId, trackedData] of trackedHands) {
    let hand = trackedData.handData;
    let handColor = trackedData.color;
    
    let index = hand.index_finger_tip;
    let thumb = hand.thumb_tip;
    let pinky = hand.pinky_finger_tip;

    // Check if hand is in erase mode (thumb-to-pinky pinch)
    let isErasing = checkEraseGesture(hand);
    let isChangingColor = checkColorChangeGesture(hand);

    // Handle color change gesture (thumb-middle pinch)
    if (isChangingColor && !trackedData.colorChangeTriggered) {
      // Pick a new random color from the palette
      let newColor = random(colorPalette);
      // Make sure it's different from current color
      while (newColor[0] === handColor[0] && newColor[1] === handColor[1] && newColor[2] === handColor[2]) {
        newColor = random(colorPalette);
      }
      trackedData.color = newColor;
      trackedData.colorChangeTriggered = true; // Prevent rapid color changes
      handColor = newColor; // Update local reference
      
      console.log(`Hand ${handId} changed color to:`, newColor);
    }    
        
    // Reset the trigger when gesture is released
    if (!isChangingColor) {
      trackedData.colorChangeTriggered = false;
    }


    
    if (isErasing) {
      // Erase mode - use midpoint between thumb and pinky as eraser center
      let x = (thumb.x + pinky.x) * 0.5;
      let y = (thumb.y + pinky.y) * 0.5;
      
      // If we just started erasing, don't draw a line from the previous position
      if (trackedData.isErasing) {
        // ACTUAL ERASING - remove pixels from painting layer
        painting.erase(); // Start erase mode
        painting.noStroke();
        painting.fill(255);
        painting.circle(x, y, 100); // Erase circle instead of line
        if (dist(x, y, trackedData.prevDrawX, trackedData.prevDrawY) < 50) {
          // If moving slowly, also erase the path between points
          painting.strokeWeight(55);
          painting.stroke(255);
          painting.line(trackedData.prevDrawX, trackedData.prevDrawY, x, y);
        }
        painting.noErase(); // End erase mode
      }
      
      // Update previous position
      trackedData.prevDrawX = x;
      trackedData.prevDrawY = y;
      trackedData.isErasing = true;
      
    } else {
      // Normal drawing mode - thumb to index pinch gesture
      let x = (index.x + thumb.x) * 0.5;
      let y = (index.y + thumb.y) * 0.5;

      // Draw only if fingers are close together (pinch)
      let d = dist(index.x, index.y, thumb.x, thumb.y);
      if (d < 20) {
        // Use this hand's unique color for drawing
        painting.stroke(handColor[0], handColor[1], handColor[2]);
        painting.strokeWeight(10);
        painting.line(trackedData.prevDrawX, trackedData.prevDrawY, x, y);
      }

      // Update previous drawing position for this specific hand
      trackedData.prevDrawX = x;
      trackedData.prevDrawY = y;
      trackedData.isErasing = false;
    }
  }
  
  // ADD THIS LINE HERE - before the painting overlay
  drawTitleAndInstructions();

  // Overlay painting on top of the video
  image(painting, 0, 0, painting.width, painting.height);

    // Draw border around the canvas
    stroke(150); // Black border
    strokeWeight(5); // Border thickness
    noFill(); // No fill, just the outline
    rect(0, 0, width, height);

  // Draw skeletons for each tracked hand
  for (let [handId, trackedData] of trackedHands) {
    let currentHand = trackedData.handData;
    let handColor = trackedData.color;
    let isErasing = trackedData.isErasing || false;

    // Loop through each connection between points
    for (let connectionIndex = 0; connectionIndex < connections.length; connectionIndex++) {
      // Get the two points that form this connection
      const point1_ID = connections[connectionIndex][0];
      const point2_ID = connections[connectionIndex][1];
      
      // Get the actual (x,y) positions of these points
      const point1 = currentHand.keypoints[point1_ID];
      const point2 = currentHand.keypoints[point2_ID];
      
      // Skip palm-to-wrist connections (the horizontal lines)
      if (point1_ID === 0 && [5, 9, 13, 17].includes(point2_ID)) {
        continue; // Skip this connection
      }
      if (point2_ID === 0 && [5, 9, 13, 17].includes(point1_ID)) {
        continue; // Skip this connection
      }

      // Different visual feedback for erase mode
      if (isErasing) {
        // White/light skeleton for erase mode with different thickness
        stroke(255, 255, 255, 120);
        strokeWeight(8);
      } else {
        // Normal colored skeleton for draw mode
        stroke(handColor[0], handColor[1], handColor[2], 200);
        strokeWeight(10);
      }
      
      line(point1.x, point1.y, point2.x, point2.y);
    }

    // Draw eraser cursor when in erase mode
    if (isErasing) {
      let thumb = currentHand.thumb_tip;
      let pinky = currentHand.pinky_finger_tip;
      let x = (thumb.x + pinky.x) * 0.5;
      let y = (thumb.y + pinky.y) * 0.5;
      
      // Draw soap emoji as eraser cursor
      push()
      imageMode(CENTER);
      image(soapEmoji, x, y, 60, 60); // Adjust size as needed
      pop()
    }
  }

// Draw image in bottom left corner
if (hsluLogo) {
  image(hsluLogo, 30, 350, 180, 30); // (image, x, y, width, height)
}

// Screenshot timer
if (millis() - screenshotTimer > screenshotInterval) {
  takeScreenshot();
  screenshotTimer = millis();
}
}

// Fullscreen functionality
function keyPressed() {
  // Press 'F' or 'f' to toggle fullscreen
  if (key === 'f' || key === 'F') {
    toggleFullscreen();
  }
}

// Fullscreen toggle function
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    // Enter fullscreen
    document.documentElement.requestFullscreen().catch(err => {
      console.log('Error attempting to enable fullscreen:', err);
    });
  } else {
    // Exit fullscreen
    document.exitFullscreen().catch(err => {
      console.log('Error attempting to exit fullscreen:', err);
    });
  }
}

// 3. Add this function anywhere (I'd put it near the bottom with keyPressed())
function takeScreenshot() {
  let date = new Date();
  let sessionName = "HandPainting"; 
  let timestamp = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')}_${date.getHours().toString().padStart(2,'0')}-${date.getMinutes().toString().padStart(2,'0')}`;
  
  save(`${sessionName}_${timestamp}.png`);
  console.log(`Screenshot saved: ${sessionName}_${timestamp}.png`);
}
