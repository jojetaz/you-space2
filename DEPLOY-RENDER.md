# Desplegar You-Space en Render

Guía paso a paso para desplegar el sitio estático You-Space en [Render](https://render.com).

## Requisitos previos

- Cuenta en [Render](https://render.com)
- Cuenta en [GitHub](https://github.com), [GitLab](https://gitlab.com) o [Bitbucket](https://bitbucket.org)
- El proyecto subido a un repositorio Git

---

## Opción 1: Despliegue manual (recomendado para empezar)

### 1. Sube tu proyecto a un repositorio Git

Si aún no tienes un repositorio:

```bash
cd c:\Users\jojet\OneDrive\Desktop\proyectos\you-space

# Inicializar Git (si no lo has hecho)
git init

# Añadir archivos
git add index.html styles.css script.js render.yaml

# Hacer commit
git commit -m "Sitio You-Space listo para desplegar"

# Crear repo en GitHub y conectar
git remote add origin https://github.com/TU-USUARIO/you-space.git
git branch -M main
git push -u origin main
```

### 2. Crear el sitio estático en Render

1. Entra en el [Dashboard de Render](https://dashboard.render.com/)
2. Haz clic en **New** → **Static Site**
3. Conecta tu repositorio (GitHub/GitLab/Bitbucket)
4. Selecciona el repositorio **you-space**
5. Configura:
   - **Name**: `you-space` (o el nombre que prefieras)
   - **Branch**: `main` (o la rama donde esté tu código)
   - **Build Command**: *(dejar vacío)*
   - **Publish Directory**: `.` (punto = directorio raíz)
6. Haz clic en **Create Static Site**

### 3. ¡Listo!

Render desplegará tu sitio. En unos minutos tendrás una URL como:

```
https://you-space.onrender.com
```

---

## Opción 2: Usando Blueprint (render.yaml)

Si quieres usar el archivo `render.yaml` incluido en el proyecto:

1. Sube el proyecto a un repositorio Git (incluyendo `render.yaml`)
2. En Render: **New** → **Blueprint**
3. Conecta tu repositorio
4. Render detectará el `render.yaml` y creará el servicio automáticamente

---

## Dominio propio

Para usar tu propio dominio:

1. Ve a tu sitio en el Dashboard de Render
2. **Settings** → **Custom Domains**
3. Añade tu dominio
4. Configura los registros DNS según las instrucciones de Render (generalmente un CNAME apuntando a tu URL de Render)

---

## Actualizaciones automáticas

Cada vez que hagas `git push` a la rama configurada, Render desplegará automáticamente los cambios.
