
"use strict";
import * as THREE from 'three';
import { ArcballControls } from 'three/addons/controls/ArcballControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';


let scene, camera, renderer, earth, pyramid;  // Bases pour le rendu Three.js
let controls; // Pour l'interaction avec la souris
let canvas;  // Le canevas où est dessinée la scène
let ambient_light;
let camera_light;
let last_render = Date.now();


// VARIABLES POUR LA TERRE
let earth_orbit_radius = 1; // Définissez le rayon de l'orbite de la Terre
let earth_angle = 0; // Angle initial de la Terre
let earth_orbit_speed = 0.005; // La vitesse de rotation de la Terre autour du soleil
let earth_self_rotation_speed = 0.005; // Vous pouvez ajuster cette valeur pour contrôler la vitesse
let earthTexture;

// VARIABLES POUR LES PYRAMIDES
let pyramid_orbit_speed = 0.005; // Vitesse de rotation de la pyramide autour de la Terre
let pyramids = [];  // Nouvelle structure pour suivre les pyramides
let pyramid_model;

// VARIABLES POUR LE SATELLITE
let satellite_orbit_radius = earth_orbit_radius / 8;
let satellite_angle = 0; // Angle initial du satellite autour de la Terre
let satellite_orbit_speed = 0.01; // Vitesse de rotation du satellite autour de la Terre
let satellite; // Variable globale pour le satellite

// VARIABLES POUR L'ORBITE DU SATELLITE
let satelliteOrbit;
let L2_orbit_angle = 0; // Angle initial de l'orbite
const L2_orbit_speed = 0.005; // Vitesse de rotation de l'orbite

// VARIBLES POUR LES ETOILES
let starsPositions;
let starTexture;

// VARIABLES CONTENANT LES COORDONNES DES POINTS DE LAGRANGE
let L1_position; 
let L2_position;
let L3_position;
let L4_position;
let L5_position;


/* Création de la scène 3D */
function createScene() {
    // Initialiser une nouvelle scène Three.js
    scene = new THREE.Scene();
    // Définir la couleur d'arrière-plan de la scène en noir
    scene.background = new THREE.Color(0, 0, 0);

    // Appeler la fonction pour dessiner les étoiles dans la scène
    draw_stars();

    // Dessiner le soleil et l'ajouter à la scène
    const sun = draw_sun();
    scene.add(sun);

    // Dessiner l'orbite de la planète et l'ajouter à la scène
    const orbit = draw_orbit();
    scene.add(orbit);

    // Dessiner la Terre et l'ajouter à la scène
    earth = draw_earth();
    scene.add(earth);

    // Ajouter une source de lumière directionnelle à la scène
    add_light();

    // Dessiner les points de Lagrange et la seconde orbite (verte) autour du point L2
    draw_lagrange_points();

    // Initialiser et ajouter l'orbite verte du satellite autour du point L2 à la scène
    satelliteOrbit = draw_orbit(0x00ff00, satellite_orbit_radius); // Couleur verte pour l'orbite
    satelliteOrbit.position.copy(L2_position); // Positionner cette orbite autour du point L2
    scene.add(satelliteOrbit);

    // Créer une caméra avec un champ de vision, un ratio d'aspect, et des plans de coupe
    camera = new THREE.PerspectiveCamera(45, canvas.width / canvas.height, 0.1, 100);
    // Positionner la caméra dans la scène
    camera.position.x = 2;
    camera.position.y = 2;
    camera.position.z = 1;
    // Orienter la caméra vers le centre de la scène
    camera.lookAt(0, 0, 0);
    // Ajouter la caméra à la scène
    scene.add(camera);

    // Ajouter une lumière ambiante à la scène
    ambient_light = new THREE.AmbientLight("white", 0.0);
    scene.add(ambient_light);

    // Ajouter une lumière directionnelle et l'attacher à la caméra
    camera_light = new THREE.DirectionalLight("white", 0.0);
    camera.add(camera_light);
}


function generate_randomStars() {
    // TODO: générer les positions des étoiles
    let stars = [];
    for (let i = 0; i < 100; i++) { // Generer 100 etoiles
        let radius = 1 + Math.random(); // Rayon entre 1 et 2
        let theta = Math.random() * Math.PI * 2; // Angle du theta
        let phi = Math.acos((Math.random() * 2) - 1); // Angle phi pour une distribution uniforme sur la sphère
        let x = radius * Math.sin(phi) * Math.cos(theta);
        let y = radius * Math.sin(phi) * Math.sin(theta);
        let z = radius * Math.cos(phi);
        stars.push(new THREE.Vector3(x, y, z));
    }
    return stars;
}

function generate_pyramid_IFS(){
    // Coordonnées des sommets d'un tétraèdre (pyramide à base triangulaire)
    // IFS est utilisé ici pour définir une structure géométrique répétitive.
    // Chaque sommet est défini par ses coordonnées x, y, z dans l'espace 3D.
    const vertices = new Float32Array([
        Math.sqrt(8/9), 0, -1/3, // v1
        -Math.sqrt(2/9), Math.sqrt(2/3), -1/3, // v2
        -Math.sqrt(2/9), -Math.sqrt(2/3), -1/3, // v3
        0, 0, 1 // v4
    ]);

    // Indices des triangles formant les faces de la pyramide
    // Les indices sont des références aux points dans le tableau de sommets.
    // Chaque groupe de trois indices définit une face triangulaire de la pyramide.
    const indices = new Uint16Array([
        0, 1, 2,  // Face 1: Utilise les sommets 1 (v1), 2 (v2) et 3 (v3)
        0, 2, 3,  // Face 2: Utilise les sommets 1 (v1), 3 (v3) et 4 (v4)
        0, 3, 1,  // Face 3: Utilise les sommets 1 (v1), 4 (v4) et 2 (v2)
        1, 3, 2   // Base: Utilise les sommets 2 (v2), 4 (v4) et 3 (v3)
    ]);
    
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

    // Calcul des vecteurs normaux pour chaque face de la pyramide
    // Chaque normale est calculée en utilisant le produit vectoriel des arêtes de chaque face
    const normals = new Float32Array([
        // normal = (B - A) x (C - A) puis normalisation

        // Normale de la face 1 (calculée à partir des sommets v1, v2, v3)
        // Produit vectoriel des vecteurs (v2-v1) et (v3-v1), puis normalisation du résultat
        // ici la normale est [0, 0, 1], car la face est parallèle au plan XY
        0.0, 0.0, 1.0,  // Normale de la face 1
    
        // Normale de la face 2 (calculée à partir des sommets v1, v3, v4)
        // Produit vectoriel des vecteurs (v3-v1) et (v4-v1), puis normalisation du résultat
        // Le résultat [-0.48666, 0.81110, -0.32444] est la normale unitaire de cette face
        -0.48666426339228763, 0.8111071056538127, -0.3244428422615251,  // Normale de la face 2
    
        // Normale de la face 3 (calculée à partir des sommets v1, v4, v2)
        // Produit vectoriel des vecteurs (v4-v1) et (v2-v1), puis normalisation du résultat
        // Le résultat [-0.48666, -0.81110, -0.32444] est la normale unitaire de cette face
        -0.48666426339228763, -0.8111071056538127, -0.3244428422615251,  // Normale de la face 3
    
        // Normale de la base (calculée à partir des sommets v2, v4, v3)
        // Produit vectoriel des vecteurs (v4-v2) et (v3-v2), puis normalisation du résultat
        // Le résultat [0.98639, 0, -0.16439] est la normale unitaire de cette face
        0.9863939238321436, 0.0, -0.1643989873053573  // Normale de la base
    ]);

    // Assigner les normaux calculés à la géométrie
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));

    // Utilisation de MeshPhongMaterial qui réagit à la lumière
    const material = new THREE.MeshBasicMaterial({
        color: 0xffffff, // Couleur de base
        emissive: 0x111111, // Faible couleur d'émission pour un léger effet lumineux
        
    });

    let model = { geometry, material };

    return model;
}


function draw_lagrange_points() {
    const pyramidSize = new THREE.Vector3(0.03, 0.03, 0.03); // Définir la taille de la pyramide
    const sunPosition = new THREE.Vector3(0, 0, 0); // Le Soleil est au centre de la scene

    pyramids.push({
        mesh: draw_pyramid(pyramid_model, "red", L1_position, pyramidSize),
        orbitRadius: 0.7,
        orbitSpeed: pyramid_orbit_speed,
        angle: 0, // Theta = 0
        orbitCenter: sunPosition
    });
    
    pyramids.push({
        mesh: draw_pyramid(pyramid_model, "green", L2_position, pyramidSize),
        orbitRadius: 1.3,
        orbitSpeed: pyramid_orbit_speed,
        angle: 0, // Theta = 0
        orbitCenter: sunPosition
    });
    
    pyramids.push({
        mesh: draw_pyramid(pyramid_model, "blue", L3_position, pyramidSize),
        orbitRadius: 1.0,
        orbitSpeed: pyramid_orbit_speed,
        angle: Math.PI, // Theta = 180 degrees
        orbitCenter: sunPosition
    });
    
    pyramids.push({
        mesh: draw_pyramid(pyramid_model, "yellow", L4_position, pyramidSize),
        orbitRadius: 1.0,
        orbitSpeed: pyramid_orbit_speed,
        angle: Math.PI / 3, // Theta = 60 degrees
        orbitCenter: sunPosition
    });
    
    pyramids.push({
        mesh: draw_pyramid(pyramid_model, "cyan", L5_position, pyramidSize),
        orbitRadius: 1.0,
        orbitSpeed: pyramid_orbit_speed,
        angle: -Math.PI / 3, // Theta = -60 degrees equivalent de 5 * Math.PI / 3
        orbitCenter: sunPosition
    });
}

// Cette fonction aide à convertir les coordonnées polaires (r, theta) en coordonnées cartésiennes
function polarToCartesian(r, theta) {
    return new THREE.Vector3(r * Math.cos(theta), 0, r * Math.sin(theta));
}

function draw_pyramid(model, color, position, size) {
    // Cloner le matériau du modèle de la pyramide pour créer une instance unique
    const pyramidMaterial = model.material.clone();
    // Définir la couleur du matériau de la pyramide en fonction de l'argument 'color'
    pyramidMaterial.color.set(color);
    // Créer un mesh (forme 3D) pour la pyramide en utilisant la géométrie et le matériau spécifiés
    const pyramid = new THREE.Mesh(model.geometry, pyramidMaterial);
    // Régler l'échelle de la pyramide en fonction de l'argument 'size'
    pyramid.scale.set(size.x, size.y, size.z);
    // Positionner la pyramide dans la scène en fonction de l'argument 'position'
    pyramid.position.set(position.x, position.y, position.z);

    // Ajouter la pyramide à la scène globale
    scene.add(pyramid);

    // Retourner la pyramide pour pouvoir l'utiliser ailleurs dans le code
    return pyramid;
}


function draw_sun() {
    const geometry = new THREE.SphereGeometry(0.1, 32, 32); // Sphere avec le rayon de 0.5
    
    const yellow = new THREE.Color(0xffff00); // Couleur jaune
    const orange = new THREE.Color(0xffa500); // Couleur orange

    // Interpoler entre jaune et orange
    const colorMix = yellow.lerp(orange, 0.5); // facteur d'interpolation (0.5 pour un mélange égal)
    const material = new THREE.MeshBasicMaterial({ color: colorMix }); // Materiau jaune sans illumination
    const sun = new THREE.Mesh(geometry, material);
    
    return sun; 
}

function draw_earth() { 
    // Créer le matériau de la Terre avec la texture appliquée
    const earthMaterial = new THREE.MeshLambertMaterial({
        map: earthTexture // Utilise la texture importe chargée pour la Terre
    });
    // Créer la géométrie sphérique de la Terre
    const earthGeometry = new THREE.SphereGeometry(0.1, 32, 32); // Rayon de 0.1, 32 segments en latitude et longitude
    // Créer le mesh de la Terre en utilisant la géométrie et le matériau
    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    // Définir la position de la Terre sur son orbite
    earthMesh.position.set(1, 0, 0); // Position sur l'axe X à 1, Y et Z à 0

    // Retourner le mesh de la Terre pour utilisation dans d'autres parties du code
    return earthMesh;
}



function draw_stars() {
    // Création d'un matériau pour les étoiles avec la texture étoile chargée
    const starsMaterial = new THREE.PointsMaterial({
        size: 0.03, // Définir la taille des points représentant les étoiles
        map: starTexture, // Utiliser la texture étoile chargée
        sizeAttenuation: true, // Activer l'atténuation de la taille en fonction de la distance
    });

    // Création de la géométrie pour les étoiles
    const starsGeometry = new THREE.BufferGeometry();
    // Transformer la liste des positions des étoiles en un attribut de position pour la géométrie
    const positionAttribute = new THREE.Float32BufferAttribute(starsPositions.flatMap(star => [star.x, star.y, star.z]), 3);
    starsGeometry.setAttribute('position', positionAttribute); // Assigner les positions des étoiles

    // Création de l'objet Points représentant l'ensemble des étoiles
    const stars = new THREE.Points(starsGeometry, starsMaterial);

    // Ajout de l'objet Points à la scène pour afficher les étoiles
    scene.add(stars);
}



function draw_orbit(orbitColor = 0xffffff, orbitRadius = 1) {
    // Création d'un tableau pour stocker les points de l'orbite
    const points = [];
    // Boucle pour générer un cercle de points représentant l'orbite
    for (let i = 0; i <= 360; i++) {
        let rad = THREE.MathUtils.degToRad(i); // Conversion degrés en radians
        // Calcul et ajout des points de l'orbite dans le plan x-z
        points.push(new THREE.Vector3(orbitRadius * Math.cos(rad), 0, orbitRadius * Math.sin(rad))); 
    }

    // Création de la géométrie à partir des points de l'orbite
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    // Création du matériau pour le tracé de l'orbite
    const material = new THREE.LineBasicMaterial({ color: orbitColor });
    // Création de l'objet Line pour représenter l'orbite
    const orbit = new THREE.Line(geometry, material);

    // Retourner l'objet Line représentant l'orbite
    return orbit;
}


function add_light() {
    const light = new THREE.PointLight(0xffffff, 1, 100);
    light.position.set(0, 0, 0); // La lumière vient du soleil

    scene.add(light);
}


function animate() {
    // Ajout d'une lumière de point de vue
    let camera_light_intensity = document.getElementById("toggleViewlight").checked;
    if (camera_light_intensity) {
        camera_light.intensity = 1.0;
    } else {
        camera_light.intensity = 0.0;
    }

    // Ajout d'une lumière ambiante
    let ambient_light_intensity = document.getElementById("controlAmbientLight").value;
    ambient_light.intensity = ambient_light_intensity/ 100;

    // Affichage du gizmo pour l'interaction avec la souris
    let acrball_gizmo = document.getElementById("toggleGizmo");
    if (acrball_gizmo.checked) {
        controls.setGizmosVisible(true);
    } else {
        controls.setGizmosVisible(false);
    }

    // Contrôle de l'animation
    let run_animation = document.getElementById("toggleAnimation");
    if (run_animation.checked) {
        // Mise à jour de l'angle de la Terre
        earth.rotateY(earth_self_rotation_speed);
        earth_angle += earth_orbit_speed;
        // Conversion en coordonnees cartesiennes
        earth.position.x = earth_orbit_radius * Math.cos(earth_angle);
        earth.position.z = earth_orbit_radius * Math.sin(earth_angle);

        // Mise à jour de l'angle de l'orbite de L2 autour du soleil
        L2_orbit_angle += L2_orbit_speed;

        // Calculer la nouvelle position de L2 autour du soleil
        const satelliteOrbit_x = L2_position.x * Math.cos(L2_orbit_angle);
        const satelliteOrbit_z = L2_position.x * Math.sin(L2_orbit_angle);

        // Mettre à jour la position de l'orbite verte pour qu'elle suive L2 tout en tournant autour de son propre centre
        satelliteOrbit.position.set(satelliteOrbit_x, 0, satelliteOrbit_z);

        // Mettre à jour l'angle et la position du satellite
        if (satellite) { // Vérifier si le satellite a été chargé
            satellite_angle += satellite_orbit_speed; // Mettre à jour l'angle du satellite

            const satelliteX = satelliteOrbit_x + satellite_orbit_radius * Math.cos(satellite_angle);
            const satelliteZ = satelliteOrbit_z + satellite_orbit_radius * Math.sin(satellite_angle);

            // Définir la nouvelle position du satellite
            satellite.position.set(satelliteX, 0, satelliteZ);
        }

        // Pour chaque pyramide dans le tableau pyramides
        pyramids.forEach((pyramidData) => {
            // Incrémenter l'angle de la pyramide en fonction de sa vitesse orbitale
            pyramidData.angle += pyramidData.orbitSpeed;

            // Convertir l'angle en coordonnées cartésiennes par rapport au centre de l'orbite
            // Calculer la position x de la pyramide en fonction de son rayon orbital et de son angle actuel
            let pyramidX = pyramidData.orbitCenter.x + pyramidData.orbitRadius * Math.cos(pyramidData.angle);
            // Calculer la position z de la pyramide de la même manière
            let pyramidZ = pyramidData.orbitCenter.z + pyramidData.orbitRadius * Math.sin(pyramidData.angle);

            // Mettre à jour la position de la pyramide avec les nouvelles coordonnées x et z
            pyramidData.mesh.position.set(pyramidX, pyramidData.mesh.position.y, pyramidZ);
        });
        
    }   
    last_render = Date.now();
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    
}

function init() {
    try {
        canvas = document.getElementById("canvas");
        
        renderer = new THREE.WebGLRenderer({canvas: canvas, antialias: true});
        renderer.setSize( canvas.clientWidth, canvas.clientHeight );
        document.body.appendChild(renderer.domElement);


    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML="<p><b>Sorry, an error occurred:<br>" +
            e + "</b></p>";
        return;
    }

    // Initialisation de la scène
    starsPositions = generate_randomStars(); 
    pyramid_model = generate_pyramid_IFS(); 
    
    L1_position = new THREE.Vector3(0.7, 0, 0);  // r = 0.7, theta = 0
    L2_position = new THREE.Vector3(1.3, 0, 0);  // r = 1.3, theta = 0
    L3_position = new THREE.Vector3(-1.0, 0, 0); // r = 1.0, theta = 180
    L4_position = polarToCartesian(1.0, THREE.MathUtils.degToRad(60)); // r = 1.0, theta = 60
    L5_position = polarToCartesian(1.0, THREE.MathUtils.degToRad(-60)); // r = 1.0, theta = -60

    const textureLoader = new THREE.TextureLoader();
    // Charger la texture pour les étoiles
    starTexture = textureLoader.load('../tp2_etoile.png');
    // Charger la texture pour la Terre
    earthTexture = textureLoader.load('../tp2_texture_planete.jpg'); 

    const loader = new GLTFLoader();

    // Charger le modèle 3D du satellite
    loader.load('../tp2_satellite.glb', function (gltf) {
        // Réduire la taille du modèle
        gltf.scene.scale.set(0.01, 0.01, 0.01); 
        // Définir la position du satellite près de L2
        gltf.scene.position.copy(new THREE.Vector3(L2_position.x + satellite_orbit_radius, 0, 0));
        // Ajuster la rotation du satellite pour qu'il soit aligné correctement
        gltf.scene.rotation.x = -(Math.PI / 2);
        // Stocker la scène du satellite dans la variable globale 'satellite'
        satellite = gltf.scene;
        // Ajouter le modèle du satellite à la scène près de L2
        scene.add(satellite);
    }, undefined, function (error) {
        // Afficher les erreurs de chargement dans la console
        console.error(error);
    });

    
    // Création de la scène 3D
    createScene();
    
    // Ajout de l'interactivité avec la souris
    controls = new ArcballControls(camera, canvas, scene);
    controls.setGizmosVisible(false);

    // Animation de la scèene (appelée toutes les 30 ms)
    animate();
}

init();