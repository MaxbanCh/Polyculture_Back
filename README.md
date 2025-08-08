# Polyculture
## Le site de la culture aux multiples facettes !

# Présentation du projet
## Introduction
**Polyculture** est un site web de Culture Générale, inspiré notamment des sites *Squiz*, *Quizypedia* et *KCulture*, qui permet de s'amuser et d'apprendre grâce à des questions sur différents thèmes, avec différents modes de jeux, en solo et en multi !

J'ai eu la volonté de faire ce projet car depuis plusieurs années sur mon temps libre je rédige des questions de culture générale et des anecdotes, je les stockais ainsi sur differents support (Notes, fichiers PDF, etc...) et le potentiel était vite limité, notamment pour la recherche de question (plusieurs centaines). 

De plus je cherchais un moyen de pouvoir poser non plus des simples questions à réponse simple, mais d'autres types de question avec des images ou des sons, ou encore des réponses à choix.

Le projet est accessible sur mon Github :
-    Repo pour le Backend : https://github.com/MaxbanCh/Polyculture_Back
-    Repo pour le FrontEnd : https://github.com/MaxbanCh/Polyculture_front
-    Fichier Docker Compose : https://github.com/MaxbanCh/PolyCulture/blob/main/docker-compose.yml


## Les différentes fonctionnalités
### Room Multijoueur
Ce mode de jeu se rapproche du jeu *Squiz*, on peut créer une room privée avec plusieurs joueurs, des questions défilent selon des thèmes ou des pools de questions, et le but est de répondre le plus rapidement par rapport aux autres joueurs pour obtenir un maximum de points, pour gagner la partie.

Les cas de déconnexion des joueurs sont notamment gérés par le serveur, et il y a également la possibilité de revenir dans la partie.

### Buzzer Multijoueur
Ce mode de jeu permet d'avoir une salle privée afin d'utiliser un buzzer pour pouvoir répondre a des questions à l'oral par exemple. L'admin de la room à la possibilité notamment d'accéder à des questions aléatoires en fonctions de thèmes, d'attribuer des points à des joueurs, et de gérer les buzzers des autres joueurs présents dans la room.

### Défi
Cette section est accessible en solo, et permet d'enchainer des questions, soit de thème a l'infini (dans la limite de questions dispo), ou de faire les meilleurs temps et score sur un pool de questions.  

### Admin - La gestion des questions
(NB : Cette partie sera sûrement accessible pour les utilisateurs classiques dans le futur, juste un manque de temps pour l'implémentation)  

L'admin peut ainsi gérer les questions comme l'ajout, la modification (Question, Thème, réponse et type) et la suppression.  

Il est également possible de créer des pools de questions, qui permettent de meler des quesions de différents thèmes, pour prevoir des quizs sur des questions spécifiques.  

# Choix, implémentations et difficultés techniques
## Utilisation de Vue TS + Deno
L'utilisation de Vue était autorisée dans les consignes, je me suis donc dit que c'était une bonne opportunité pour apprendre ce framework !  
Il s'est avéré que je n'ai finalement pas profité de tous les avantages que présentaient Vue, notamment l'appel de composants dans d'autres, à cause de la gestion des variables et des retours de fonctions présentes dans des composants imbriqués, que je n'ai pas réussi à implémenter de maniere efficace.  

A noter également que le linter de Deno n'est pas disponible lorsqu'on insère du script dans des balises script dans les fichiers vue, ce qui ne permettait un CI efficace localement.  

De plus Deno ne permet d'executer directement des fichiers Vue, il est donc nécessaire de d'abord compiler les fichiers (notamment avec Vite) puis d'utiliser ces fichiers dans Deno.

## Le format de réponse libre et distance de Levenshtein
Lorsque je cherchais à reproduire le systeme de réponse libre de Squiz, rapidement s'est posée la question de comment je gérais les petites fautes de frappes, les accents, etc... tout ce qui pourrait nuire à la rapidité des joueur.euse.s. Je suis alors tombé sur la Distance de Levenshtein, qui permet grâce à un algorithme de calculer la différence entre deux mots. (en comptant les remplacements de lettre, les permutations, etc...) Ce qui est donc implémenté dans mon projet dans le back pour la vérification des réponses, apres avoir normalisé les réponses.  

(Nota Bene concernant Map pour la création de tableau à deux dimensions et aussi dans d'autres endroits du code : Il me semble avoir entendu dans une conférence que les maps étaient plus optimisées qu'une itération manuelle à l'éxecution, ce qui justifie mon choix de cette implémentation lorsque c'était possible, pertinent et que ça n'allourdissait pas trop le code)

## Utilisation des Websockets
Les websockets sont utilisés dans les espaces multijoueurs du site (Room Multi et Buzzer), ce qui permet le temps réel entre les différents utilisateur.ice.s, la gestion des requêtes (envoi des questions, des réponses, des signaux de partie et de buzzer, ainsi que les connexions et déconnexions)  

A noter que toute la gestion de la logique des jeux se passe cote serveur, le client ne fait qu'afficher les informations que le serveur lui envoie, et renvoyer les inputs utilisateurs.

## Déploiement
### Une première étape sur un serveur perso
Avant de déployer sur le cluster IG3 de Polytech, je me suis d'abord entrainé avec un serveur chez moi, afin d'approfondir mes quelques connaissances de base concernant Docker. Le site est donc accessible via l'IP http://83.195.188.17. N'ayant toutefois pas de nom de domaine, je n'ai pu faire fonctionner le HTTPS, étant donné que celà semblait poser problème pour les certificats auto-signés. A noter que la branche est toujours accessible sur les Github (branche homeDeploy)

**Pour executer la version locale**
```
cd /votre/repertoire/
git clone https://github.com/MaxbanCh/Polyculture_Back.git
cd Polyculture_Back
git switch homeDeploy 
cd ../

git clone https://github.com/MaxbanCh/Polyculture_Back.git
cd Polyculture_Back
git switch homeDeploy 
cd ../
```
A noter qu'il faut remplacer toutes les ip par celle voulue pour le fonctionnement des routes.
Il faut également récupérer le fichier docker compose.
```
docker compose up --build
``` 


### Le cloud de Polytech
J'ai ainsi pu déployer sur le cloud de polytech assez facilement étant donné que les DockerFile étaient déjà réalisés, en implémantant ainsi le HTTPS. L'application est accessible via https://polyculture.axithem.fr

## La base de données
L'application est basé actuellement sur 5 tables concrètes :
-  La table Users (id, username, hashed-password, description, admin, created-at)
-  Themes (id, nom, description)
-  Subthemes (id, nom, description, themeId)
-  Questions (id, intitule, type, answer, media, created-at, subthemeId) (NB : les attributs usersId et validated sont a prevoir pour la creation des questions personalises utilisateurs)
-  QuestionPool (id, name, description, userId, isPublic, Questions (relation n - n))

Les tables attemptsDefi et attemptsPool sont implémentés mais les routes n'ont pas été faites par manque de temps.

## Authentification via LocalStorage
Le token d'authentification est stocké dans le localstorage et non dans les cookies, il s'agit honnêtement d'un oubli...

## L'accès à la section Admin
L'accès est sécurisé avec la nécessité d'avoir un token de connexion fournit par le serveur. Ce token, lors de l'accès à une page admin, va être envoyé au serveur pour savoir s'il est associé à un admin d'une part, d'autre part de vérifier la validité du token dans le back. Et rédirige ou non en fonction de la réponse du serveur.

Cette sécurité est mise en place d'une part dans le router du front et également au cas où lors du chargement de la page admin. 

## Architecture CRUD et REST
Les méthodes et routes des questions respectent la création via post, l'accès via get, la mise à jour via put et la suppression via delete.

## Systeme anti-triche
Lorsque les questions sont récuperées par le client, les réponses ne sont pas envoyées, la verification se fait côté serveur.


# Ameliorations potentielles non mentionnees precedemment
## Autres types de questions
Je n'ai pas eu le temps d'implémenter les differents types de questions, ainsi que les médias, la gestion est prévue dans la database mais les routes et le front ne sont pas implémentés

## Systeme de classement
Il était prevu initialement que les scores soient envoyés sur le serveur pour faire un systeme de classement, qui n'a pas été fait, faute de solutions trouvées qui pourrait être scalé à grande échelle
